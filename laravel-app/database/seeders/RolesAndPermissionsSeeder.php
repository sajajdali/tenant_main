<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
            'specialized_courses.view',
            'specialized_courses.create',
            'specialized_courses.update',
            'specialized_courses.delete',
            'specialized_course_orders.view',
        ];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        $adminRole = Role::findOrCreate('admin', 'web');
        $barberRole = Role::findOrCreate('barber', 'web');
        $salesExpertRole = Role::findOrCreate('sales_expert', 'web');
        $salesManagerRole = Role::findOrCreate('sales_manager', 'web');
        $teacherRole = Role::findOrCreate('teacher', 'web');

        $adminRole->syncPermissions($permissions);
        $barberRole->syncPermissions([
            'users.view',
        ]);
        $salesExpertRole->syncPermissions([
            'users.view',
        ]);
        $salesManagerRole->syncPermissions([
            'users.view',
        ]);
        $teacherRole->syncPermissions([
            'specialized_courses.view',
            'specialized_courses.create',
            'specialized_courses.update',
            'specialized_course_orders.view',
        ]);

        User::query()
            ->where('mobile', '09122978167')
            ->first()?->syncRoles([$adminRole]);
    }
}
