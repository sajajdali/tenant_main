<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\InputNormalizer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\View\View;

class UserController extends Controller
{
    private const ROLE_KEYS = ['barber', 'admin', 'teacher', 'sales_expert', 'sales_manager'];

    public function index(Request $request): View
    {
        $status = $request->string('status')->toString();
        $role = $request->string('role')->toString();

        $users = User::query()
            ->with('salesManager:id,name,mobile')
            ->with('teacherProfile:user_id,commission_percent')
            ->withCount('ownedTenants')
            ->when($status === 'active', fn ($query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn ($query) => $query->where('is_active', false))
            ->when($role !== '', fn ($query) => $query->where('role', $role))
            ->latest()
            ->paginate(10)
            ->withQueryString();

        return view('admin.users.index', [
            'users' => $users,
            'status' => $status,
            'role' => $role,
            'roleLabels' => $this->roleOptions(),
        ]);
    }

    public function create(): View
    {
        return view('admin.users.form', [
            'user' => new User([
                'role' => 'barber',
                'is_active' => true,
            ]),
            'isEdit' => false,
            'roleOptions' => $this->roleOptions(),
            'salesManagers' => $this->salesManagers(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatePayload($request);

        $user = User::query()->create([
            'name' => $validated['name'],
            'mobile' => $validated['mobile'],
            'email' => $validated['email'] ?? null,
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'sales_commission_percent' => $validated['sales_commission_percent'],
            'sales_manager_user_id' => $validated['sales_manager_user_id'],
            'sales_manager_commission_percent' => $validated['sales_manager_commission_percent'],
            'is_active' => (bool) $validated['is_active'],
        ]);

        if ($validated['role'] === 'teacher') {
            $user->teacherProfile()->updateOrCreate([], [
                'commission_percent' => $validated['course_commission_percent'],
            ]);
        }

        $user->syncRoles([$validated['role']]);

        return redirect()
            ->route('admin.users.index')
            ->with('success', __('admin.users.messages.created'));
    }

    public function edit(User $user): View
    {
        return view('admin.users.form', [
            'user' => $user,
            'isEdit' => true,
            'roleOptions' => $this->roleOptions(),
            'salesManagers' => $this->salesManagers($user),
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $this->validatePayload($request, $user);

        $payload = [
            'name' => $validated['name'],
            'mobile' => $validated['mobile'],
            'email' => $validated['email'] ?? null,
            'role' => $validated['role'],
            'sales_commission_percent' => $validated['sales_commission_percent'],
            'sales_manager_user_id' => $validated['sales_manager_user_id'],
            'sales_manager_commission_percent' => $validated['sales_manager_commission_percent'],
            'is_active' => (bool) $validated['is_active'],
        ];

        if (! empty($validated['password'])) {
            $payload['password'] = Hash::make($validated['password']);
        }

        $user->update($payload);

        if ($validated['role'] === 'teacher') {
            $user->teacherProfile()->updateOrCreate([], [
                'commission_percent' => $validated['course_commission_percent'],
            ]);
        } else {
            $user->teacherProfile()?->delete();
        }

        $user->syncRoles([$validated['role']]);

        return redirect()
            ->route('admin.users.index')
            ->with('success', __('admin.users.messages.updated'));
    }

    public function destroy(User $user): RedirectResponse
    {
        if ((int) auth()->id() === (int) $user->id) {
            return redirect()
                ->route('admin.users.index')
                ->withErrors(['delete' => __('admin.users.messages.cannot_delete_self')]);
        }

        $user->delete();

        return redirect()
            ->route('admin.users.index')
            ->with('success', __('admin.users.messages.deleted'));
    }

    private function validatePayload(Request $request, ?User $user = null): array
    {
        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
        ]);

        $passwordRules = $user
            ? ['nullable', 'string', 'min:4', 'confirmed']
            : ['required', 'string', 'min:4', 'confirmed'];

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'mobile' => ['required', 'regex:/^09\d{9}$/', 'unique:users,mobile,' . ($user?->id ?? 'NULL')],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email,' . ($user?->id ?? 'NULL')],
            'password' => $passwordRules,
            'role' => ['required', 'in:'.implode(',', self::ROLE_KEYS)],
            'sales_commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'sales_manager_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'sales_manager_commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'course_commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['required', 'boolean'],
        ], [
            'mobile.required' => __('admin.users.validation.mobile_required'),
            'mobile.regex' => __('admin.users.validation.mobile_regex'),
            'mobile.unique' => __('admin.users.validation.mobile_unique'),
        ]);

        if ($validated['role'] === 'teacher') {
            if ($validated['course_commission_percent'] === null || $validated['course_commission_percent'] === '') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'course_commission_percent' => __('admin.users.validation.course_commission_required'),
                ]);
            }

            if ($validated['sales_commission_percent'] === null || $validated['sales_commission_percent'] === '') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'sales_commission_percent' => __('admin.users.validation.teacher_sales_commission_required'),
                ]);
            }

            $validated['sales_manager_user_id'] = null;
            $validated['sales_manager_commission_percent'] = null;

            return $validated;
        }

        $validated['course_commission_percent'] = null;

        if (! in_array($validated['role'], ['sales_expert', 'sales_manager'], true)) {
            $validated['sales_commission_percent'] = null;
            $validated['sales_manager_user_id'] = null;
            $validated['sales_manager_commission_percent'] = null;

            return $validated;
        }

        if ($validated['sales_commission_percent'] === null || $validated['sales_commission_percent'] === '') {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'sales_commission_percent' => $validated['role'] === 'sales_manager'
                    ? __('admin.users.validation.sales_manager_commission_required')
                    : __('admin.users.validation.sales_expert_commission_required'),
            ]);
        }

        if ($validated['role'] === 'sales_manager') {
            $validated['sales_manager_user_id'] = null;
            $validated['sales_manager_commission_percent'] = null;

            return $validated;
        }

        if (! empty($validated['sales_manager_user_id'])) {
            $manager = User::query()->find($validated['sales_manager_user_id']);

            if (! $manager || $manager->role !== 'sales_manager') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'sales_manager_user_id' => __('admin.users.validation.sales_manager_invalid'),
                ]);
            }

            if ($user && (int) $user->id === (int) $manager->id) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'sales_manager_user_id' => __('admin.users.validation.sales_manager_self'),
                ]);
            }

            if ($validated['sales_manager_commission_percent'] === null || $validated['sales_manager_commission_percent'] === '') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'sales_manager_commission_percent' => __('admin.users.validation.sales_manager_commission_required'),
                ]);
            }
        } else {
            $validated['sales_manager_commission_percent'] = null;
        }

        return $validated;
    }

    /**
     * @return array<int, User>
     */
    private function salesManagers(?User $currentUser = null): array
    {
        return User::query()
            ->where('role', 'sales_manager')
            ->when($currentUser?->exists, fn ($query) => $query->whereKeyNot($currentUser->id))
            ->orderBy('name')
            ->get(['id', 'name', 'mobile'])
            ->all();
    }

    /**
     * @return array<string, string>
     */
    private function roleOptions(): array
    {
        return collect(self::ROLE_KEYS)
            ->mapWithKeys(fn (string $role) => [$role => __('admin.users.roles.'.$role)])
            ->all();
    }
}
