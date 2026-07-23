@php
    $hasChildren = ! empty($item['children'] ?? []);
    $url = $item['route'] ?? null ? route($item['route'], $item['query'] ?? []) : '#!';
    $isActive = false;

    if (($item['route'] ?? null) && request()->routeIs($item['route'])) {
        $query = $item['query'] ?? [];
        $isActive = collect($query)->every(fn ($value, $key) => request()->query($key) == $value);
        $isActive = $query === [] ? true : $isActive;
    }

    if ($hasChildren) {
        $isActive = collect($item['children'])->contains(function ($child) {
            if (! isset($child['route'])) {
                return false;
            }

            if (! request()->routeIs($child['route'])) {
                return false;
            }

            $query = $child['query'] ?? [];

            return collect($query)->every(fn ($value, $key) => request()->query($key) == $value);
        });
    }
@endphp

@if (($item['type'] ?? 'menu') === 'caption')
    <li class="pc-item pc-caption">
        <label>{{ $item['label'] }}</label>
        @if (! empty($item['icon']))
            <i class="{{ $item['icon'] }}"></i>
        @endif
    </li>
@else
    <li class="pc-item {{ $hasChildren ? 'pc-hasmenu' : '' }} {{ $isActive ? 'active' : '' }}">
        <a href="{{ $hasChildren ? '#!' : $url }}" class="pc-link">
            @if (! empty($item['icon']))
                <span class="pc-micon"><i class="{{ $item['icon'] }}"></i></span>
            @endif
            <span class="pc-mtext">{{ $item['label'] }}</span>
            @if ($hasChildren)
                <span class="pc-arrow"><i data-feather="chevron-right"></i></span>
            @endif
        </a>

        @if ($hasChildren)
            <ul class="pc-submenu" style="{{ $isActive ? 'display:block;' : '' }}">
                @foreach ($item['children'] as $child)
                    @include('admin.partials.sidebar-item', ['item' => $child, 'level' => $level + 1])
                @endforeach
            </ul>
        @endif
    </li>
@endif
