<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Store\Models\StoreOrder;
use App\Domain\Tenant\Models\SmsBlacklist;
use App\Support\TenantAudienceScope;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SmsCampaignAudienceService
{
    public const PRESETS = [
        'all_customers',
        'by_barber',
        'by_service',
        'inactive_customers',
        'inactive_service_customers',
        'single_visit',
        'loyal_customers',
        'cancelled_appointments',
        'booked_for_others',
        'new_customers',
        'at_risk_customers',
        'store_customers',
        'store_paid_customers',
        'store_pending_customers',
        'store_no_orders',
        'high_value_store_customers',
        'nutrition_no_diets',
        'nutrition_has_diets',
        'nutrition_session_number',
        'nutrition_package_expired',
        'nutrition_package_active',
        'nutrition_active_diet',
        'nutrition_pending_request',
    ];

    public function preview(array $filters, int $limit = 10): array
    {
        $query = $this->buildAudienceQuery($filters);

        $total = (clone $query)->count();
        $samples = (clone $query)
            ->limit($limit)
            ->get()
            ->map(fn ($row) => $this->mapRecipientRow($row))
            ->values()
            ->all();

        return [
            'total' => $total,
            'samples' => $samples,
        ];
    }

    public function recipients(array $filters): Collection
    {
        return $this->buildAudienceQuery($filters)
            ->get()
            ->map(fn ($row) => $this->mapRecipientRow($row))
            ->values();
    }

    private function buildAudienceQuery(array $filters): Builder
    {
        $preset = (string) ($filters['preset'] ?? 'all_customers');
        $barberId = isset($filters['professional_id'])
            ? (int) $filters['professional_id']
            : (isset($filters['barber_id']) ? (int) $filters['barber_id'] : null);
        $serviceId = isset($filters['service_id']) ? (int) $filters['service_id'] : null;
        $inactiveMonths = isset($filters['inactive_months']) ? (int) $filters['inactive_months'] : null;
        $newCustomerDays = isset($filters['new_customer_days']) ? (int) $filters['new_customer_days'] : 30;
        $loyalMinAppointments = isset($filters['loyal_min_appointments']) ? (int) $filters['loyal_min_appointments'] : 3;
        $minStoreTotalAmount = isset($filters['min_store_total_amount']) ? (int) $filters['min_store_total_amount'] : 0;
        $nutritionSessionNumber = isset($filters['nutrition_session_number']) ? (int) $filters['nutrition_session_number'] : 1;

        if (str_starts_with($preset, 'nutrition_')) {
            return $this->buildNutritionAudienceQuery($preset, $nutritionSessionNumber);
        }

        $activeStatuses = ['booked', 'completed', 'no_show'];

        $aggregate = Appointment::query()
            ->from('appointments as ap')
            ->selectRaw('
                ap.customer_phone_snapshot as customer_phone,
                MAX(ap.id) as latest_appointment_id,
                MAX(ap.appointment_date) as last_appointment_at,
                MIN(ap.appointment_date) as first_appointment_at,
                COUNT(*) as appointments_count
            ')
            ->whereIn('ap.status', $activeStatuses)
            ->groupBy('ap.customer_phone_snapshot');

        $storeAggregate = StoreOrder::query()
            ->from('store_orders as so')
            ->selectRaw('
                so.customer_phone as customer_phone,
                COUNT(*) as store_orders_count,
                SUM(CASE WHEN so.status IN ("paid","processing","shipped","delivered") THEN 1 ELSE 0 END) as store_paid_orders_count,
                SUM(CASE WHEN so.status IN ("pending_payment","awaiting_card_transfer","placed") THEN 1 ELSE 0 END) as store_pending_orders_count,
                SUM(CASE WHEN so.status IN ("paid","processing","shipped","delivered") THEN so.total_amount ELSE 0 END) as store_total_amount
            ')
            ->groupBy('so.customer_phone');

        $query = DB::query()
            ->fromSub($aggregate, 'audience')
            ->join('appointments as latest_appointment', 'latest_appointment.id', '=', 'audience.latest_appointment_id')
            ->leftJoinSub($storeAggregate, 'store_agg', 'store_agg.customer_phone', '=', 'audience.customer_phone')
            ->leftJoin('sms_blacklists as blacklist', 'blacklist.phone', '=', 'audience.customer_phone')
            ->whereNull('blacklist.id')
            ->selectRaw('
                audience.customer_phone,
                latest_appointment.customer_name_snapshot as customer_name,
                latest_appointment.professional_id as last_barber_id,
                latest_appointment.professional_name_snapshot as last_barber_name,
                latest_appointment.service_id as last_service_id,
                latest_appointment.service_name_snapshot as last_service_name,
                audience.last_appointment_at,
                audience.first_appointment_at,
                audience.appointments_count,
                COALESCE(store_agg.store_orders_count, 0) as store_orders_count,
                COALESCE(store_agg.store_paid_orders_count, 0) as store_paid_orders_count,
                COALESCE(store_agg.store_pending_orders_count, 0) as store_pending_orders_count,
                COALESCE(store_agg.store_total_amount, 0) as store_total_amount
            ')
            ->orderByDesc('audience.last_appointment_at');

        $addHasAppointmentFilter = function (Builder $query) use ($barberId, $serviceId, $activeStatuses): void {
            if ($barberId) {
                $query->whereExists(function ($subQuery) use ($barberId, $activeStatuses) {
                    $subQuery
                        ->selectRaw('1')
                        ->from('appointments as filter_barber')
                        ->whereColumn('filter_barber.customer_phone_snapshot', 'audience.customer_phone')
                        ->where('filter_barber.professional_id', $barberId)
                        ->whereIn('filter_barber.status', $activeStatuses);
                });
            }

            if ($serviceId) {
                $query->whereExists(function ($subQuery) use ($serviceId, $activeStatuses) {
                    $subQuery
                        ->selectRaw('1')
                        ->from('appointments as filter_service')
                        ->whereColumn('filter_service.customer_phone_snapshot', 'audience.customer_phone')
                        ->where('filter_service.service_id', $serviceId)
                        ->whereIn('filter_service.status', $activeStatuses);
                });
            }
        };

        match ($preset) {
            'all_customers' => null,
            'by_barber' => $addHasAppointmentFilter($query),
            'by_service' => $addHasAppointmentFilter($query),
            'inactive_customers' => $query->whereDate('audience.last_appointment_at', '<=', now()->subMonths(max($inactiveMonths ?: 2, 1))->toDateString()),
            'inactive_service_customers' => (function () use ($query, $addHasAppointmentFilter, $inactiveMonths): void {
                $addHasAppointmentFilter($query);
                $query->whereDate('audience.last_appointment_at', '<=', now()->subMonths(max($inactiveMonths ?: 2, 1))->toDateString());
            })(),
            'single_visit' => $query->where('audience.appointments_count', 1),
            'loyal_customers' => $query->where('audience.appointments_count', '>=', max($loyalMinAppointments, 2)),
            'cancelled_appointments' => $query->whereExists(function ($subQuery) {
                $subQuery
                    ->selectRaw('1')
                    ->from('appointments as cancelled_appointment')
                    ->whereColumn('cancelled_appointment.customer_phone_snapshot', 'audience.customer_phone')
                    ->where('cancelled_appointment.status', 'cancelled');
            }),
            'booked_for_others' => $query->whereExists(function ($subQuery) {
                $subQuery
                    ->selectRaw('1')
                    ->from('appointments as booked_for_others')
                    ->whereColumn('booked_for_others.customer_phone_snapshot', 'audience.customer_phone')
                    ->where('booked_for_others.meta->is_for_someone_else', true);
            }),
            'new_customers' => $query->whereDate('audience.first_appointment_at', '>=', now()->subDays(max($newCustomerDays, 1))->toDateString()),
            'at_risk_customers' => $query
                ->where('audience.appointments_count', '>=', 2)
                ->whereDate('audience.last_appointment_at', '<=', now()->subMonths(max($inactiveMonths ?: 3, 1))->toDateString()),
            'store_customers' => $query->whereRaw('COALESCE(store_agg.store_orders_count, 0) > 0'),
            'store_paid_customers' => $query->whereRaw('COALESCE(store_agg.store_paid_orders_count, 0) > 0'),
            'store_pending_customers' => $query->whereRaw('COALESCE(store_agg.store_pending_orders_count, 0) > 0'),
            'store_no_orders' => $query->whereRaw('COALESCE(store_agg.store_orders_count, 0) = 0'),
            'high_value_store_customers' => $query->whereRaw('COALESCE(store_agg.store_total_amount, 0) >= ?', [max($minStoreTotalAmount, 1)]),
            default => null,
        };

        if (in_array($preset, ['all_customers', 'by_barber', 'by_service'], true)) {
            $addHasAppointmentFilter($query);
        }

        return $query;
    }

    private function buildNutritionAudienceQuery(string $preset, int $nutritionSessionNumber): Builder
    {
        if (! TenantAudienceScope::currentTenantUsesNutrition() || ! Schema::hasTable('nutrition_diet_requests')) {
            return DB::table('users as tenant_users')
                ->selectRaw('tenant_users.mobile as customer_phone, tenant_users.name as customer_name')
                ->whereRaw('1 = 0');
        }

        $requestsAggregate = DB::table('nutrition_diet_requests as req')
            ->selectRaw('
                req.user_id,
                COUNT(*) as nutrition_requests_count,
                MAX(req.created_at) as latest_nutrition_activity_at
            ')
            ->groupBy('req.user_id');

        $publishedPrescriptionsAggregate = DB::table('nutrition_diet_prescriptions as pr')
            ->selectRaw('
                pr.user_id,
                COUNT(*) as nutrition_published_diets_count
            ')
            ->whereNotNull('pr.published_at')
            ->groupBy('pr.user_id');

        $activePackageAggregate = DB::table('nutrition_package_subscriptions as sub')
            ->selectRaw('
                sub.user_id,
                COUNT(*) as nutrition_active_package_count
            ')
            ->where('sub.status', 'active')
            ->where(function ($query): void {
                $query->whereNull('sub.ends_at')
                    ->orWhereDate('sub.ends_at', '>=', now()->toDateString());
            })
            ->groupBy('sub.user_id');

        $anyPackageAggregate = DB::table('nutrition_package_subscriptions as sub')
            ->selectRaw('
                sub.user_id,
                COUNT(*) as nutrition_package_count
            ')
            ->groupBy('sub.user_id');

        $activeDietAggregate = DB::table('nutrition_diet_prescriptions as pr')
            ->selectRaw('
                pr.user_id,
                COUNT(*) as nutrition_active_diet_count
            ')
            ->where('pr.status', 'active')
            ->where('pr.is_current', true)
            ->whereNotNull('pr.published_at')
            ->where(function ($query): void {
                $query->whereNull('pr.ends_at')
                    ->orWhereDate('pr.ends_at', '>=', now()->toDateString());
            })
            ->groupBy('pr.user_id');

        $pendingRequestAggregate = DB::table('nutrition_diet_requests as req')
            ->selectRaw('
                req.user_id,
                COUNT(*) as nutrition_pending_request_count
            ')
            ->whereIn('req.status', ['sent', 'in_progress', 'not_sent'])
            ->groupBy('req.user_id');

        $query = DB::table('users as tenant_users')
            ->leftJoinSub($requestsAggregate, 'nutrition_req', 'nutrition_req.user_id', '=', 'tenant_users.id')
            ->leftJoinSub($publishedPrescriptionsAggregate, 'nutrition_pub', 'nutrition_pub.user_id', '=', 'tenant_users.id')
            ->leftJoinSub($activePackageAggregate, 'nutrition_active_pkg', 'nutrition_active_pkg.user_id', '=', 'tenant_users.id')
            ->leftJoinSub($anyPackageAggregate, 'nutrition_any_pkg', 'nutrition_any_pkg.user_id', '=', 'tenant_users.id')
            ->leftJoinSub($activeDietAggregate, 'nutrition_active_diet', 'nutrition_active_diet.user_id', '=', 'tenant_users.id')
            ->leftJoinSub($pendingRequestAggregate, 'nutrition_pending_req', 'nutrition_pending_req.user_id', '=', 'tenant_users.id')
            ->leftJoin('sms_blacklists as blacklist', 'blacklist.phone', '=', 'tenant_users.mobile')
            ->where('tenant_users.role', 'customer')
            ->where('tenant_users.is_active', true)
            ->whereNull('blacklist.id')
            ->selectRaw('
                tenant_users.mobile as customer_phone,
                tenant_users.name as customer_name,
                NULL as last_barber_id,
                NULL as last_barber_name,
                NULL as last_service_id,
                NULL as last_service_name,
                NULL as last_appointment_at,
                NULL as first_appointment_at,
                0 as appointments_count,
                0 as store_orders_count,
                0 as store_paid_orders_count,
                0 as store_total_amount,
                COALESCE(nutrition_req.nutrition_requests_count, 0) as nutrition_requests_count,
                COALESCE(nutrition_pub.nutrition_published_diets_count, 0) as nutrition_published_diets_count,
                COALESCE(nutrition_active_pkg.nutrition_active_package_count, 0) as nutrition_active_package_count,
                COALESCE(nutrition_any_pkg.nutrition_package_count, 0) as nutrition_package_count,
                COALESCE(nutrition_active_diet.nutrition_active_diet_count, 0) as nutrition_active_diet_count,
                COALESCE(nutrition_pending_req.nutrition_pending_request_count, 0) as nutrition_pending_request_count,
                nutrition_req.latest_nutrition_activity_at as latest_nutrition_activity_at
            ')
            ->orderByDesc('latest_nutrition_activity_at')
            ->orderByDesc('tenant_users.created_at');

        match ($preset) {
            'nutrition_no_diets' => $query->whereRaw('COALESCE(nutrition_req.nutrition_requests_count, 0) = 0'),
            'nutrition_has_diets' => $query->whereRaw('COALESCE(nutrition_req.nutrition_requests_count, 0) > 0'),
            'nutrition_session_number' => $query->whereRaw('COALESCE(nutrition_req.nutrition_requests_count, 0) = ?', [max($nutritionSessionNumber, 1)]),
            'nutrition_package_expired' => $query
                ->whereRaw('COALESCE(nutrition_any_pkg.nutrition_package_count, 0) > 0')
                ->whereRaw('COALESCE(nutrition_active_pkg.nutrition_active_package_count, 0) = 0'),
            'nutrition_package_active' => $query->whereRaw('COALESCE(nutrition_active_pkg.nutrition_active_package_count, 0) > 0'),
            'nutrition_active_diet' => $query->whereRaw('COALESCE(nutrition_active_diet.nutrition_active_diet_count, 0) > 0'),
            'nutrition_pending_request' => $query->whereRaw('COALESCE(nutrition_pending_req.nutrition_pending_request_count, 0) > 0'),
            default => null,
        };

        return $query;
    }

    private function mapRecipientRow(object $row): array
    {
        return [
            'customer_phone' => (string) ($row->customer_phone ?? ''),
            'customer_name' => ($row->customer_name ?? null) ?: null,
            'last_barber_id' => ($row->last_barber_id ?? null) ? (int) $row->last_barber_id : null,
            'last_barber_name' => ($row->last_barber_name ?? null) ?: null,
            'last_service_id' => ($row->last_service_id ?? null) ? (int) $row->last_service_id : null,
            'last_service_name' => ($row->last_service_name ?? null) ?: null,
            'last_appointment_at' => $this->formatDate($row->last_appointment_at ?? null),
            'first_appointment_at' => $this->formatDate($row->first_appointment_at ?? null),
            'appointments_count' => (int) ($row->appointments_count ?? 0),
            'store_orders_count' => (int) ($row->store_orders_count ?? 0),
            'store_paid_orders_count' => (int) ($row->store_paid_orders_count ?? 0),
            'store_total_amount' => (int) ($row->store_total_amount ?? 0),
            'nutrition_requests_count' => (int) ($row->nutrition_requests_count ?? 0),
            'nutrition_published_diets_count' => (int) ($row->nutrition_published_diets_count ?? 0),
            'nutrition_active_package_count' => (int) ($row->nutrition_active_package_count ?? 0),
            'nutrition_active_diet_count' => (int) ($row->nutrition_active_diet_count ?? 0),
            'latest_nutrition_activity_at' => $this->formatDate($row->latest_nutrition_activity_at ?? null),
        ];
    }

    private function formatDate(mixed $value): ?string
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse((string) $value)->toDateString();
    }
}
