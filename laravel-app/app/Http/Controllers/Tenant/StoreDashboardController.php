<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Store\Models\StoreOrder;
use App\Domain\Store\Models\StoreProduct;
use App\Domain\Store\Models\StoreProductReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class StoreDashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $productsCount = StoreProduct::query()->count();
        $ordersCount = StoreOrder::query()->count();
        $newOrdersCount = StoreOrder::query()
            ->whereIn('status', ['pending_payment', 'awaiting_card_transfer', 'placed', 'processing'])
            ->count();
        $reviewsCount = StoreProductReview::query()->count();

        $latestOrders = StoreOrder::query()
            ->with(['items', 'payments'])
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(function (StoreOrder $order): array {
                return [
                    'id' => (string) $order->id,
                    'orderNumber' => $order->order_number,
                    'status' => $order->status,
                    'paymentMethod' => $order->payment_method,
                    'shippingMethod' => $order->shipping_method,
                    'customerName' => $order->customer_name,
                    'customerPhone' => $order->customer_phone,
                    'itemsCount' => (int) $order->items_count,
                    'subtotalAmount' => (int) $order->subtotal_amount,
                    'shippingAmount' => (int) $order->shipping_amount,
                    'discountAmount' => (int) $order->discount_amount,
                    'totalAmount' => (int) $order->total_amount,
                    'createdAt' => optional($order->created_at)?->toDateTimeString(),
                    'items' => $order->items->take(3)->map(fn ($item): array => [
                        'title' => (string) $item->title,
                        'quantity' => (int) $item->quantity,
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();

        $latestReviews = StoreProductReview::query()
            ->with('product')
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(function (StoreProductReview $review): array {
                return [
                    'id' => (string) $review->id,
                    'reviewerName' => $review->reviewer_name,
                    'rating' => (int) $review->rating,
                    'body' => $review->body,
                    'adminReply' => $review->admin_reply,
                    'isApproved' => (bool) $review->is_approved,
                    'createdAt' => optional($review->created_at)?->toDateTimeString(),
                    'product' => [
                        'id' => (string) $review->product->id,
                        'title' => $review->product->title,
                    ],
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'productsCount' => $productsCount,
                    'ordersCount' => $ordersCount,
                    'newOrdersCount' => $newOrdersCount,
                    'reviewsCount' => $reviewsCount,
                ],
                'latestOrders' => $latestOrders,
                'latestReviews' => $latestReviews,
            ],
        ]);
    }
}
