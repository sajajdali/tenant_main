<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Store\Models\StoreProduct;
use App\Domain\Store\Models\StoreProductReview;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class StoreProductReviewController extends Controller
{
    public function adminIndex(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $items = StoreProductReview::query()
            ->with('product:id,title')
            ->latest('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (StoreProductReview $review) => $this->transformReview($review))->values()->all(),
            ],
        ]);
    }

    public function publicIndex(StoreProduct $storeProduct): JsonResponse
    {
        $this->ensureProductReviewEnabled($storeProduct);

        $items = $storeProduct->reviews()
            ->where('is_approved', true)
            ->latest('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (StoreProductReview $review) => $this->transformReview($review))->values()->all(),
            ],
        ]);
    }

    public function publicStore(Request $request, StoreProduct $storeProduct): JsonResponse
    {
        abort_unless($storeProduct->is_active, 404);
        $this->ensureProductReviewEnabled($storeProduct);

        $validated = $request->validate([
            'reviewer_name' => ['nullable', 'string', 'max:120'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $user = $request->user('tenant_web');
        $reviewerName = trim((string) ($validated['reviewer_name'] ?? ''));

        if ($reviewerName === '' && $user) {
            $reviewerName = trim((string) ($user->name ?? '')) ?: (string) ($user->phone ?? '');
        }

        if ($reviewerName === '') {
            $reviewerName = __('store.review.default_reviewer');
        }

        $review = $storeProduct->reviews()->create([
            'tenant_user_id' => $user?->id,
            'reviewer_name' => $reviewerName,
            'rating' => (int) $validated['rating'],
            'body' => trim((string) $validated['body']),
            'is_approved' => false,
            'approved_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('store.review.submitted'),
            'data' => $this->transformReview($review),
        ]);
    }

    public function index(Request $request, StoreProduct $storeProduct): JsonResponse
    {
        $this->ensureAdmin($request);

        $items = $storeProduct->reviews()
            ->latest('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (StoreProductReview $review) => $this->transformReview($review))->values()->all(),
            ],
        ]);
    }

    public function moderate(Request $request, StoreProductReview $storeProductReview): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'is_approved' => ['nullable', 'boolean'],
            'admin_reply' => ['nullable', 'string', 'max:5000'],
        ]);

        if (array_key_exists('is_approved', $validated)) {
            $isApproved = (bool) $validated['is_approved'];
            $storeProductReview->is_approved = $isApproved;
            $storeProductReview->approved_at = $isApproved ? Carbon::now() : null;
        }

        if (array_key_exists('admin_reply', $validated)) {
            $storeProductReview->admin_reply = trim((string) ($validated['admin_reply'] ?? '')) ?: null;
        }

        $storeProductReview->save();

        return response()->json([
            'success' => true,
            'message' => __('store.review.updated'),
            'data' => $this->transformReview($storeProductReview),
        ]);
    }

    public function destroy(Request $request, StoreProductReview $storeProductReview): JsonResponse
    {
        $this->ensureAdmin($request);
        $storeProductReview->delete();

        return response()->json([
            'success' => true,
            'message' => __('store.review.deleted'),
        ]);
    }

    private function ensureProductReviewEnabled(StoreProduct $storeProduct): void
    {
        abort_unless($storeProduct->is_active, 404);
        $metadata = is_array($storeProduct->metadata) ? $storeProduct->metadata : [];
        abort_if(($metadata['reviews_enabled'] ?? true) !== true, 404);
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }

    private function transformReview(StoreProductReview $review): array
    {
        return [
            'id' => (string) $review->id,
            'storeProductId' => (string) $review->store_product_id,
            'productTitle' => $review->relationLoaded('product') ? ($review->product?->title ?? null) : null,
            'tenantUserId' => $review->tenant_user_id ? (string) $review->tenant_user_id : null,
            'reviewerName' => (string) $review->reviewer_name,
            'rating' => (int) $review->rating,
            'body' => (string) $review->body,
            'adminReply' => $review->admin_reply,
            'isApproved' => (bool) $review->is_approved,
            'createdAt' => $review->created_at?->toISOString(),
        ];
    }
}
