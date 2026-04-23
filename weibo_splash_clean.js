/*
Weibo splash ad cleaner for Quantumult X.

Use this script as script-response-body on Weibo launch/splash ad endpoints. It
keeps the original response shape but makes every splash ad non-displayable.
*/

const FAR_FUTURE_SECONDS = 3818332800;
const FAR_FUTURE_DAY_END_SECONDS = 3818419199;
const FAR_FUTURE_DATE_START = "2040-01-01 00:00:00";
const FAR_FUTURE_DATE_END = "2040-01-01 23:59:59";
const ONE_YEAR_SECONDS = 31536000;

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function parseBody(body) {
  if (typeof body !== "string" || body === "") {
    return {
      json: {},
      okSuffix: false
    };
  }

  const trimmed = body.trim();
  const hasOkSuffix = /OK$/i.test(trimmed);
  const jsonText = hasOkSuffix ? trimmed.replace(/OK$/i, "") : trimmed;

  return {
    json: JSON.parse(jsonText),
    okSuffix: hasOkSuffix
  };
}

function rewriteSdkAd(obj) {
  if (!isObject(obj)) {
    return obj;
  }

  obj.needlocation = false;
  obj.show_push_splash_ad = false;
  obj.background_delay_display_time = ONE_YEAR_SECONDS;
  obj.lastAdShow_delay_display_time = ONE_YEAR_SECONDS;
  obj.realtime_ad_video_stall_time = 0;
  obj.realtime_ad_timeout_duration = 0;

  if (Array.isArray(obj.ads)) {
    obj.ads.forEach(function (item) {
      if (!isObject(item)) {
        return;
      }
      item.displaytime = 0;
      item.displayintervel = ONE_YEAR_SECONDS;
      item.allowdaydisplaynum = 0;
      item.begintime = FAR_FUTURE_DATE_START;
      item.endtime = FAR_FUTURE_DATE_END;
    });
  }

  return obj;
}

function rewritePreloadAd(ad) {
  if (!isObject(ad)) {
    return;
  }

  ad.start_time = FAR_FUTURE_SECONDS;
  ad.end_time = FAR_FUTURE_DAY_END_SECONDS;
  ad.daily_display_cnt = 50;
  ad.total_display_cnt = 50;
  ad.display_duration = 0;
  ad.duration = 0;
  ad.show_count = 50;
}

function rewritePreload(obj) {
  if (!isObject(obj)) {
    return obj;
  }

  if (Array.isArray(obj.ads)) {
    obj.ads.forEach(function (item) {
      rewritePreloadAd(item);
      if (isObject(item) && Array.isArray(item.creatives)) {
        item.creatives.forEach(rewritePreloadAd);
      }
    });
  }

  if (isObject(obj.ads) && Array.isArray(obj.ads.creatives)) {
    obj.ads.creatives.forEach(rewritePreloadAd);
  }

  obj.foreground_req_preload = false;
  obj.background_interval = ONE_YEAR_SECONDS;
  obj.last_ad_show_interval = ONE_YEAR_SECONDS;

  return obj;
}

function rewritePullAd(obj) {
  if (!isObject(obj)) {
    return obj;
  }

  if (isObject(obj.cached_ad) && Array.isArray(obj.cached_ad.ads)) {
    obj.cached_ad.ads.forEach(function (item) {
      if (!isObject(item)) {
        return;
      }
      item.show_count = 50;
      item.duration = 0;
      item.start_date = FAR_FUTURE_SECONDS;
      item.end_date = FAR_FUTURE_DAY_END_SECONDS;
    });
  }

  return obj;
}

function cleanSplashBody(url, body) {
  const parsed = parseBody(body);
  let obj = parsed.json;
  let useOkSuffix = parsed.okSuffix;

  if (/\/interface\/sdk\/sdkad\.php/i.test(url)) {
    obj = rewriteSdkAd(obj);
    useOkSuffix = true;
  } else if (/\/v\d+\/ad\/preload/i.test(url)) {
    obj = rewritePreload(obj);
  } else if (/\/wbapplua\/wbpullad\.lua/i.test(url) || /\/preload\/get_ad/i.test(url)) {
    obj = rewritePullAd(obj);
  }

  return JSON.stringify(obj) + (useOkSuffix ? "OK" : "");
}

if (typeof $done === "function") {
  const url = (typeof $request !== "undefined" && $request && $request.url) || "";
  const body = (typeof $response !== "undefined" && $response && $response.body) || "";

  try {
    $done({ body: cleanSplashBody(url, body) });
  } catch (error) {
    console.log("weibo_splash_clean error: " + error);
    $done({ body: body });
  }
}
