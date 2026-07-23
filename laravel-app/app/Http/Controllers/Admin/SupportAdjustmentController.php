<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Models\AdminActionLog;
use App\Services\AdminSupportAdjustmentService;
use App\Support\JalaliDate;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SupportAdjustmentController extends Controller
{
    public function __construct(
        private readonly AdminSupportAdjustmentService $service,
    ) {
    }

    public function index(Request $request): View
    {
        abort_unless($request->user()?->role === 'admin', 403);

        return view('admin.support-adjustments.index', [
            'tenants' => Tenant::query()
                ->with(['owner:id,name,mobile', 'subscriptionPackage:id,name,user_limit,duration_days'])
                ->latest()
                ->paginate(15),
            'packages' => SubscriptionPackage::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
                ->orderBy('duration_days')
                ->get(),
            'history' => AdminActionLog::tableExists()
                ? AdminActionLog::query()
                    ->with(['actor', 'tenant'])
                    ->where('action_type', 'tenant_support_reduced')
                    ->latest('occurred_at')
                    ->limit(50)
                    ->get()
                : new EloquentCollection(),
            'formatDate' => fn ($date) => $date ? JalaliDate::format($date) : '—',
            'historyLoggingAvailable' => AdminActionLog::tableExists(),
        ]);
    }

    public function store(Request $request, Tenant $tenant): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'subscription_package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
            'new_support_ends_at' => ['required', 'date'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        $package = SubscriptionPackage::query()->findOrFail($validated['subscription_package_id']);

        $this->service->reduceSupportPackage(
            $tenant,
            $package,
            $validated['new_support_ends_at'],
            $validated['reason'],
            $request->user(),
        );

        return redirect()
            ->route('admin.support-adjustments.index')
            ->with('success', 'کاهش بسته یا تاریخ پشتیبانی با موفقیت ثبت شد.');
    }
}
