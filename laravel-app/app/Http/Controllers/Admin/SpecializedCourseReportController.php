<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SpecializedCourse;
use App\Models\User;
use App\Services\SpecializedCourseRevenueService;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SpecializedCourseReportController extends Controller
{
    public function __construct(
        private readonly SpecializedCourseRevenueService $revenues,
    ) {
    }

    public function index(Request $request): View
    {
        $actor = $request->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);

        $this->revenues->syncPaidOrderCommissions($actor->role === 'teacher' ? $actor : null);

        $filters = [
            'status' => $request->string('status')->toString(),
            'teacher_user_id' => $request->integer('teacher_user_id') ?: null,
            'specialized_course_id' => $request->integer('specialized_course_id') ?: null,
            'date_from' => $request->string('date_from')->toString(),
            'date_to' => $request->string('date_to')->toString(),
            'search' => $request->string('search')->toString(),
        ];

        $orders = $this->revenues
            ->ordersQueryForActor($actor, $filters)
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return view('admin.specialized-courses.report', [
            'orders' => $orders,
            'summary' => $this->revenues->summaryForActor($actor, $filters),
            'courseBreakdown' => $this->revenues->breakdownByCourse($actor, $filters),
            'teacherBreakdown' => $actor->role === 'admin'
                ? $this->revenues->breakdownByTeacher($actor, $filters)
                : collect(),
            'filters' => $filters,
            'isTeacher' => $actor->role === 'teacher',
            'teachers' => $actor->role === 'admin'
                ? User::query()->where('role', 'teacher')->orderBy('name')->get(['id', 'name'])
                : collect([$actor]),
            'courses' => SpecializedCourse::query()
                ->when($actor->role === 'teacher', fn ($query) => $query->where('teacher_user_id', $actor->id))
                ->orderBy('title')
                ->get(['id', 'title']),
        ]);
    }
}
