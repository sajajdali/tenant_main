@extends('admin.layouts.app')

@section('title', __('admin.ai_settings.title'))

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ __('admin.ai_settings.title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.ai_settings.description') }}</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.ai-settings.update') }}">
                        @csrf
                        @method('PUT')

                        <div class="row g-4">
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="enabled" name="enabled" value="1" @checked(old('enabled', $aiSettings['enabled'] ?? false))>
                                    <label class="form-check-label" for="enabled">{{ __('admin.ai_settings.enabled_label') }}</label>
                                </div>
                                <div class="form-text">{{ __('admin.ai_settings.enabled_help') }}</div>
                            </div>

                            <div class="col-md-7">
                                <label class="form-label" for="api_key">API Key</label>
                                <input
                                    type="text"
                                    id="api_key"
                                    name="api_key"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('api_key', '') }}"
                                    placeholder="{{ __('admin.ai_settings.api_key_placeholder') }}"
                                >
                                <div class="form-text">
                                    {{ __('admin.ai_settings.api_key_help') }}
                                    @if(! empty($aiSettings['api_key']))
                                        <span class="d-block mt-1">{{ __('admin.ai_settings.current_key') }}: <code dir="ltr">{{ $aiSettings['api_key'] }}</code></span>
                                    @endif
                                </div>
                            </div>

                            <div class="col-md-5">
                                <label class="form-label" for="base_url">Request URL</label>
                                <input
                                    type="text"
                                    id="base_url"
                                    name="base_url"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('base_url', $aiSettings['base_url'] ?? 'https://api.openai.com/v1/chat/completions') }}"
                                    placeholder="https://api.openai.com/v1/chat/completions"
                                >
                                <div class="form-text">
                                    {{ __('admin.ai_settings.base_url_help_before') }} <code dir="ltr">https://api.openai.com/v1/chat/completions</code> {{ __('admin.ai_settings.base_url_help_after') }}
                                    {{ __('admin.ai_settings.base_url_v1_help_before') }} <code dir="ltr">/v1</code> {{ __('admin.ai_settings.base_url_v1_help_after') }} <code dir="ltr">/chat/completions</code> {{ __('admin.ai_settings.base_url_v1_help_suffix') }}
                                </div>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="model">Model</label>
                                <input
                                    type="text"
                                    id="model"
                                    name="model"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('model', $aiSettings['model'] ?? 'gpt-4.1-mini') }}"
                                    placeholder="gpt-4.1-mini"
                                    required
                                >
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="model_version">Model Version</label>
                                <input
                                    type="text"
                                    id="model_version"
                                    name="model_version"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('model_version', $aiSettings['model_version'] ?? '') }}"
                                    placeholder="{{ __('admin.ai_settings.model_version_placeholder') }}"
                                >
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="model_display_names">{{ __('admin.ai_settings.model_display_names') }}</label>
                                <textarea
                                    id="model_display_names"
                                    name="model_display_names"
                                    class="form-control"
                                    dir="ltr"
                                    rows="4"
                                    placeholder="gpt-4.1-mini = gtyy"
                                >{{ old('model_display_names', \App\Support\OpenAiSettings::modelDisplayNamesToText($aiSettings['model_display_names'] ?? [])) }}</textarea>
                                <div class="form-text">
                                    {{ __('admin.ai_settings.model_display_names_help_before') }} <code dir="ltr">gpt-4.1-mini = gtyy</code>. {{ __('admin.ai_settings.model_display_names_help_after') }}
                                </div>
                            </div>

                            <div class="col-md-2">
                                <label class="form-label" for="timeout_seconds">Timeout</label>
                                <input
                                    type="number"
                                    min="10"
                                    max="600"
                                    id="timeout_seconds"
                                    name="timeout_seconds"
                                    class="form-control"
                                    value="{{ old('timeout_seconds', $aiSettings['timeout_seconds'] ?? 90) }}"
                                >
                            </div>

                            <div class="col-md-2">
                                <label class="form-label" for="temperature">Temperature</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    id="temperature"
                                    name="temperature"
                                    class="form-control"
                                    value="{{ old('temperature', $aiSettings['temperature'] ?? 0.3) }}"
                                >
                            </div>

                            <div class="col-md-3">
                                <label class="form-label" for="proxy_url">SOCKS Proxy</label>
                                <input
                                    type="text"
                                    id="proxy_url"
                                    name="proxy_url"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('proxy_url', $aiSettings['proxy_url'] ?? '') }}"
                                    placeholder="socks5h://user:pass@127.0.0.1:1080"
                                >
                                <div class="form-text">
                                    {{ __('admin.ai_settings.proxy_help_before') }} <code dir="ltr">socks5h://</code> {{ __('admin.ai_settings.proxy_help_after') }}
                                    {{ __('admin.ai_settings.example') }}: <code dir="ltr">socks5h://sajjad:Sajjad%4016022@5.202.47.241:45888</code>
                                </div>
                            </div>

                            <div class="col-md-3 d-flex align-items-center">
                                <div>
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" role="switch" id="proxy_enabled" name="proxy_enabled" value="1" @checked(old('proxy_enabled', $aiSettings['proxy_enabled'] ?? false))>
                                        <label class="form-check-label" for="proxy_enabled">{{ __('admin.ai_settings.proxy_enabled_label') }}</label>
                                    </div>
                                    <div class="form-text">{{ __('admin.ai_settings.proxy_enabled_help') }}</div>
                                </div>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="nutrition_token_unit_price_toman">{{ __('admin.ai_settings.token_price_label') }}</label>
                                <div class="input-group">
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000000"
                                        id="nutrition_token_unit_price_toman"
                                        name="nutrition_token_unit_price_toman"
                                        class="form-control"
                                        value="{{ old('nutrition_token_unit_price_toman', $aiSettings['nutrition_token_unit_price_toman'] ?? 1) }}"
                                    >
                                    <span class="input-group-text">{{ __('admin.ai_settings.iran_toman_unit') }}</span>
                                </div>
                                <div class="form-text">{{ __('admin.ai_settings.token_price_help') }}</div>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="nutrition_initial_token_grant">{{ __('admin.ai_settings.initial_token_grant_label') }}</label>
                                <div class="input-group">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100000000"
                                        id="nutrition_initial_token_grant"
                                        name="nutrition_initial_token_grant"
                                        class="form-control"
                                        value="{{ old('nutrition_initial_token_grant', $aiSettings['nutrition_initial_token_grant'] ?? 2500) }}"
                                    >
                                    <span class="input-group-text">{{ __('admin.ai_settings.token_unit') }}</span>
                                </div>
                                <div class="form-text">{{ __('admin.ai_settings.initial_token_grant_help') }}</div>
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="system_prompt">System Prompt</label>
                                <textarea
                                    id="system_prompt"
                                    name="system_prompt"
                                    class="form-control"
                                    rows="10"
                                    placeholder="{{ __('admin.ai_settings.system_prompt_placeholder') }}"
                                >{{ old('system_prompt', $aiSettings['system_prompt'] ?? '') }}</textarea>
                                <div class="form-text">{{ __('admin.ai_settings.system_prompt_help') }}</div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ __('admin.ai_settings.save') }}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
