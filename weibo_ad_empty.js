/*
Weibo ad payload empty response for Quantumult X.

Use this script as script-response-body on dedicated Weibo ad preload/strategy
endpoints. It returns valid JSON shapes with no ads.
*/

function emptyBodyForUrl(url) {
  if (/\/wbapplua\/wbpullad\.lua/i.test(url)) {
    return {
      cached_ad: {
        ads: [],
        delete_days: 0
      }
    };
  }

  if (/\/v2\/ad\/preload/i.test(url)) {
    return {
      code: 200,
      background_interval: 86400,
      last_ad_show_interval: 86400,
      foreground_req_preload: false,
      ads: []
    };
  }

  if (/\/v3\/strategy\/ad/i.test(url)) {
    return {
      code: 200,
      data: {
        operation: [],
        adids_ctr: {}
      }
    };
  }

  if (/\/interface\/sdk\/(?:sdkconfig|get-lbs-cell-info)\.php/i.test(url)) {
    return {
      code: 0,
      data: {}
    };
  }

  return {
    code: 0,
    data: {}
  };
}

if (typeof $done === "function") {
  const url = (typeof $request !== "undefined" && $request && $request.url) || "";

  try {
    $done({ body: JSON.stringify(emptyBodyForUrl(url)) });
  } catch (error) {
    console.log("weibo_ad_empty error: " + error);
    $done({ body: "{}" });
  }
}
