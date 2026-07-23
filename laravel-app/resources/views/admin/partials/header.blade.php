@php
    $roleLabel = match (auth()->user()->role) {
        'admin' => 'مدیر',
        'sales_manager' => 'مدیر فروش',
        'sales_expert' => 'کارشناس فروش',
        'barber' => 'مدیر سامانه',
        default => 'کاربر',
    };
@endphp

<header class="pc-header">
    <div class="header-wrapper">
        <div class="me-auto pc-mob-drp">
            <ul class="list-unstyled">
                <li class="pc-h-item pc-sidebar-collapse">
                    <a href="#" class="pc-head-link ms-0" id="sidebar-hide"><i class="ti ti-menu-2"></i></a>
                </li>
                <li class="pc-h-item pc-sidebar-popup">
                    <a href="#" class="pc-head-link ms-0" id="mobile-collapse"><i class="ti ti-menu-2"></i></a>
                </li>
            </ul>
        </div>

        <div class="ms-auto">
            <ul class="list-unstyled d-flex align-items-center gap-2 mb-0">
                <li class="dropdown pc-h-item header-user-profile">
                    <a class="pc-head-link dropdown-toggle arrow-none me-0" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">
                        <div class="d-flex align-items-center gap-2">
                            <div class="text-end d-none d-md-block">
                                <div class="fw-semibold">{{ auth()->user()->name }}</div>
                                <small class="text-muted">{{ auth()->user()->mobile }}</small>
                            </div>
                            <div class="user-avtar bg-light-primary rounded-circle d-flex align-items-center justify-content-center">
                                <i class="ph-duotone ph-user-circle f-22"></i>
                            </div>
                        </div>
                    </a>

                    <div class="dropdown-menu dropdown-user-profile dropdown-menu-end pc-h-dropdown">
                        <div class="dropdown-header d-flex align-items-center justify-content-between">
                            <h5 class="m-0">حساب کاربری</h5>
                        </div>
                        <div class="dropdown-body">
                            <ul class="list-group list-group-flush w-100">
                                <li class="list-group-item">
                                    <div class="d-flex align-items-center">
                                        <div class="flex-shrink-0">
                                            <div class="wid-50 rounded-circle bg-light-primary d-flex align-items-center justify-content-center">
                                                <i class="ph-duotone ph-user-circle f-28"></i>
                                            </div>
                                        </div>
                                        <div class="flex-grow-1 mx-3">
                                            <h5 class="mb-0">{{ auth()->user()->name }}</h5>
                                            <div class="text-muted">{{ auth()->user()->mobile }}</div>
                                        </div>
                                        <span class="badge bg-primary">{{ $roleLabel }}</span>
                                    </div>
                                </li>
                                <li class="list-group-item">
                                    <form method="POST" action="{{ route('admin.logout') }}">
                                        @csrf
                                        <button type="submit" class="dropdown-item border-0 bg-transparent w-100 text-end">
                                            <span class="d-flex align-items-center justify-content-end gap-2">
                                                <span>خروج</span>
                                                <i class="ph-duotone ph-power"></i>
                                            </span>
                                        </button>
                                    </form>
                                </li>
                            </ul>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</header>
