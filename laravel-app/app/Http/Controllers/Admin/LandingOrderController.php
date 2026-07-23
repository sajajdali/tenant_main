<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingOrder;
use App\Http\Controllers\Controller;
use Illuminate\View\View;

class LandingOrderController extends Controller
{
    public function index(): View
    {
        return view('admin.landing-orders.index', [
            'orders' => LandingOrder::query()
                ->with(['landingSite', 'customer', 'subscriptionPackage', 'payments'])
                ->latest('id')
                ->paginate(20),
        ]);
    }

    public function show(LandingOrder $order): View
    {
        $order->load([
            'landingSite.audienceType',
            'customer',
            'subscriptionPackage',
            'payments',
            'items',
            'provisionRequest.assignedTo',
            'provisionRequest.tenant',
        ]);

        return view('admin.landing-orders.show', [
            'order' => $order,
        ]);
    }

    public static function statusLabel(string $status): string
    {
        return match ($status) {
            LandingOrder::STATUS_PENDING_PAYMENT => __('admin.landing_orders.status.pending_payment'),
            LandingOrder::STATUS_PAID => __('admin.landing_orders.status.paid'),
            LandingOrder::STATUS_AWAITING_APPROVAL => __('admin.landing_orders.status.awaiting_approval'),
            LandingOrder::STATUS_APPROVED => __('admin.landing_orders.status.approved'),
            LandingOrder::STATUS_PROVISIONING => __('admin.landing_orders.status.provisioning'),
            LandingOrder::STATUS_PROVISIONED => __('admin.landing_orders.status.provisioned'),
            LandingOrder::STATUS_REJECTED => __('admin.landing_orders.status.rejected'),
            LandingOrder::STATUS_CANCELLED => __('admin.landing_orders.status.cancelled'),
            default => __('admin.landing_orders.status.draft'),
        };
    }
}
