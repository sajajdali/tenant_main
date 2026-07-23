export const PROFILE_HOME_REVIEW_RETURN = "profile_home_review";
export const PROFILE_HOME_REVIEW_HREF = "/nutrition/membership/review?edit_only=1&from=profile_home";

function getSearchParams() {
  return typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
}

export function isReturningToProfileHomeReview(searchParams = getSearchParams()) {
  return searchParams.get("return_to") === PROFILE_HOME_REVIEW_RETURN;
}

export function appendProfileHomeReviewReturn(href: string, shouldAppend: boolean) {
  if (!shouldAppend) {
    return href;
  }

  const url = new URL(href, "https://local.barber-book");
  url.searchParams.set("return_to", PROFILE_HOME_REVIEW_RETURN);
  return `${url.pathname}${url.search}`;
}

export function resolveProfileHomeReviewAwareHref(defaultHref: string, searchParams = getSearchParams()) {
  return isReturningToProfileHomeReview(searchParams) ? PROFILE_HOME_REVIEW_HREF : defaultHref;
}
