<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\HelpTopic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HelpTopicController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $audienceTypeId = $this->tenantAudienceTypeId();
        $module = trim((string) $request->query('module', ''));
        $includeHeaderOnly = $request->boolean('header_only', false);

        $topics = HelpTopic::query()
            ->with('audienceType:id,name,slug')
            ->active()
            ->where('show_in_help_center', true)
            ->when($includeHeaderOnly, fn ($query) => $query->where('show_in_page_header', true))
            ->when($module !== '', fn ($query) => $query->where('module_key', $module))
            ->where(function ($query) use ($audienceTypeId): void {
                $query->whereNull('audience_type_id');

                if ($audienceTypeId !== null) {
                    $query->orWhere('audience_type_id', $audienceTypeId);
                }
            })
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get()
            ->groupBy('topic_key')
            ->map(fn ($group) => $this->preferAudienceTopic($group->values(), $audienceTypeId))
            ->filter()
            ->sortBy([
                ['sort_order', 'asc'],
                ['title', 'asc'],
            ])
            ->values()
            ->map(fn (HelpTopic $topic): array => $this->serialize($topic, false))
            ->all();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $topics,
            ],
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $key = trim((string) $request->query('key', ''));

        if ($key === '') {
            return response()->json([
                'success' => false,
                'message' => __('tenant.help_topics.key_required'),
            ], 422);
        }

        $audienceTypeId = $this->tenantAudienceTypeId();
        $topic = HelpTopic::query()
            ->with('audienceType:id,name,slug')
            ->active()
            ->where('topic_key', $key)
            ->where(function ($query) use ($audienceTypeId): void {
                $query->whereNull('audience_type_id');

                if ($audienceTypeId !== null) {
                    $query->orWhere('audience_type_id', $audienceTypeId);
                }
            })
            ->get()
            ->pipe(fn ($topics) => $this->preferAudienceTopic($topics, $audienceTypeId));

        if (! $topic) {
            return response()->json([
                'success' => false,
                'message' => __('tenant.help_topics.not_found'),
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'topic' => $this->serialize($topic, true),
            ],
        ]);
    }

    private function tenantAudienceTypeId(): ?int
    {
        $value = tenant('audience_type_id');

        return $value ? (int) $value : null;
    }

    private function preferAudienceTopic($topics, ?int $audienceTypeId): ?HelpTopic
    {
        if ($audienceTypeId !== null) {
            $specific = $topics->first(fn (HelpTopic $topic): bool => (int) $topic->audience_type_id === $audienceTypeId);

            if ($specific) {
                return $specific;
            }
        }

        return $topics->first(fn (HelpTopic $topic): bool => $topic->audience_type_id === null);
    }

    private function serialize(HelpTopic $topic, bool $includeBody): array
    {
        return [
            'id' => (string) $topic->id,
            'topicKey' => $topic->topic_key,
            'moduleKey' => $topic->module_key,
            'title' => $topic->title,
            'summary' => $topic->summary,
            'body' => $includeBody ? $topic->body : null,
            'videoUrl' => $topic->videoUrl(),
            'coverImageUrl' => $topic->coverImageUrl(),
            'sortOrder' => (int) $topic->sort_order,
            'showInHelpCenter' => (bool) $topic->show_in_help_center,
            'showInPageHeader' => (bool) $topic->show_in_page_header,
            'audience' => $topic->audienceType ? [
                'id' => (string) $topic->audienceType->id,
                'name' => $topic->audienceType->name,
                'slug' => $topic->audienceType->slug,
            ] : null,
        ];
    }
}
