@extends('admin.layouts.app')
@section('title', $feature->exists ? 'ویرایش امکان' : 'ایجاد امکان')
@section('content')
@php $benefits=old('benefits',$feature->benefits_json??['','','']); while(count($benefits)<3)$benefits[]=''; @endphp
<form method="POST" enctype="multipart/form-data" action="{{ $feature->exists ? route('admin.landing-sites.features.update',[$landingSite,$feature]) : route('admin.landing-sites.features.store',$landingSite) }}">@csrf @if($feature->exists) @method('PUT') @endif
<div class="card"><div class="card-header"><h5 class="mb-0">{{ $feature->exists ? 'ویرایش' : 'ایجاد' }} صفحه امکان</h5></div><div class="card-body"><div class="row g-3">
<div class="col-md-6"><label class="form-label">عنوان</label><input required name="title" class="form-control" value="{{ old('title',$feature->title) }}"></div>
<div class="col-md-3"><label class="form-label">slug</label><input required name="slug" dir="ltr" class="form-control" value="{{ old('slug',$feature->slug) }}" placeholder="booking"></div>
<div class="col-md-3"><label class="form-label">ترتیب</label><input required type="number" min="0" name="sort_order" class="form-control" value="{{ old('sort_order',$feature->sort_order) }}"></div>
<div class="col-md-4"><label class="form-label">badge</label><input name="badge_text" class="form-control" value="{{ old('badge_text',$feature->badge_text) }}"></div>
<div class="col-md-4"><label class="form-label">وضعیت</label><select name="status" class="form-select"><option value="active" @selected(old('status',$feature->status)==='active')>فعال</option><option value="inactive" @selected(old('status',$feature->status)==='inactive')>غیرفعال</option></select></div>
<div class="col-md-4 d-flex align-items-end"><div class="form-check form-switch mb-2"><input type="checkbox" name="is_primary" value="1" class="form-check-input" id="primary" @checked(old('is_primary',$feature->is_primary))><label for="primary" class="form-check-label">نمایش در سه امکان اصلی</label></div></div>
<div class="col-12"><label class="form-label">توضیح کوتاه</label><textarea name="short_description" rows="2" class="form-control">{{ old('short_description',$feature->short_description) }}</textarea></div>
<div class="col-12"><label class="form-label">توضیحات کامل</label><textarea name="description" rows="5" class="form-control">{{ old('description',$feature->description) }}</textarea></div>
@foreach($benefits as $i=>$benefit)<div class="col-md-4"><label class="form-label">مزیت {{ $i+1 }}</label><input name="benefits[]" class="form-control" value="{{ $benefit }}"></div>@endforeach
<div class="col-md-6"><label class="form-label">ویدئو (URL)</label><input name="video_url" dir="ltr" class="form-control" value="{{ old('video_url',$feature->video_url) }}"><input type="file" name="video_file" accept="video/*" class="form-control mt-2"></div>
<div class="col-md-6"><label class="form-label">کاور ویدئو (URL)</label><input name="cover_url" dir="ltr" class="form-control" value="{{ old('cover_url',$feature->cover_url) }}"><input type="file" name="cover_file" accept="image/*" class="form-control mt-2"></div>
<div class="col-md-6"><label class="form-label">تصویر توضیحات (URL)</label><input name="image_url" dir="ltr" class="form-control" value="{{ old('image_url',$feature->image_url) }}"><input type="file" name="image_file" accept="image/*" class="form-control mt-2"></div>
<div class="col-md-6"><label class="form-label">عنوان SEO</label><input name="seo_title" class="form-control" value="{{ old('seo_title',$feature->seo_json['title']??'') }}"><label class="form-label mt-2">توضیح SEO</label><textarea name="seo_description" class="form-control">{{ old('seo_description',$feature->seo_json['description']??'') }}</textarea></div>
</div></div><div class="card-footer"><button class="btn btn-primary">ذخیره</button><a href="{{ route('admin.landing-sites.features.index',$landingSite) }}" class="btn btn-light-secondary">بازگشت</a></div></div></form>
@endsection
