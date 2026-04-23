/*
Weibo detail comment cleaner for Quantumult X.

Use this script only for /2/statuses/container_detail_comment. It removes comment
stream ad inserts and profile decorations while preserving normal comments,
comment likes, replies, and the detail page's own comment entry.
*/

const AD_TEXT = "\u5e7f\u544a";
const FOLLOW_TEXT = "\u5173\u6ce8";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function actionLogText(data) {
  const parts = [];

  if (!isObject(data)) {
    return "";
  }

  parts.push(stringValue(data.itemid));
  parts.push(stringValue(data.analysis_extra));
  parts.push(stringValue(data.photo_callback_params));
  parts.push(stringValue(data.scheme));
  parts.push(stringValue(data.mark));
  parts.push(stringValue(data.readtimetype));
  parts.push(stringValue(data.adType));

  if (isObject(data.action_log)) {
    parts.push(stringValue(data.action_log.ext));
    parts.push(stringValue(data.action_log.source));
  }
  if (isObject(data.actionlog)) {
    parts.push(stringValue(data.actionlog.ext));
    parts.push(stringValue(data.actionlog.source));
  }
  if (isObject(data.ad_object)) {
    parts.push("ad_object");
  }
  if (isObject(data.ad_actionlogs)) {
    parts.push("ad_actionlogs");
  }
  if (isObject(data.page_info)) {
    parts.push(stringValue(data.page_info.page_url));
    if (isObject(data.page_info.actionlog)) {
      parts.push(stringValue(data.page_info.actionlog.ext));
      parts.push(stringValue(data.page_info.actionlog.source));
      parts.push(stringValue(data.page_info.actionlog.ad_log_ext));
    }
    if (isObject(data.page_info.ad_click_actionlog)) {
      parts.push("ad_click_actionlog");
      parts.push(stringValue(data.page_info.ad_click_actionlog.ext));
      parts.push(stringValue(data.page_info.ad_click_actionlog.source));
    }
  }
  if (isObject(data.promotion)) {
    parts.push(stringValue(data.promotion.type));
    parts.push(stringValue(data.promotion.recommend));
    parts.push(stringValue(data.promotion.mark));
  }

  return parts.join("|");
}

function textHasAdMarker(text) {
  if (!text) {
    return false;
  }

  return (
    /(?:^|[|&?])adid(?::|=|%3D)\d+/i.test(text) ||
    /(?:^|[|&?])is_ad_weibo(?::|=|%3D)1/i.test(text) ||
    /(?:^|[|&?])source(?::|=|%3D)ad(?:$|[|&])/i.test(text) ||
    /(?:^|[|&?])source:ad(?:$|[|&])/i.test(text) ||
    /ad_click_actionlog/i.test(text) ||
    /ad_reduce/i.test(text) ||
    /openadscheme/i.test(text) ||
    /reallog_mark_ad/i.test(text) ||
    /third_party_monitor_url/i.test(text) ||
    /ad_video_bottom_button/i.test(text) ||
    /vs\.biz\.weibo\.com/i.test(text)
  );
}

function isAdPromotion(promotion) {
  if (!isObject(promotion)) {
    return false;
  }

  return (
    promotion.type === "ad" ||
    promotion.recommend === AD_TEXT ||
    promotion.adtype !== undefined ||
    promotion.ad_tag !== undefined ||
    Array.isArray(promotion.monitor_url) ||
    textHasAdMarker(actionLogText(promotion))
  );
}

function isAdData(data) {
  if (!isObject(data)) {
    return false;
  }

  if (
    data.is_ad === 1 ||
    data.is_ad === true ||
    data.ad_state === 1 ||
    data.adid !== undefined ||
    data.adType !== undefined ||
    data.mblogtypename === AD_TEXT ||
    data.readtimetype === "adMblog"
  ) {
    return true;
  }

  if (
    isObject(data.ad_object) ||
    isObject(data.ad_actionlogs) ||
    isObject(data.ad_videoinfo) ||
    isObject(data.page_info && data.page_info.ad_click_actionlog)
  ) {
    return true;
  }

  if (isAdPromotion(data.promotion)) {
    return true;
  }

  return textHasAdMarker(actionLogText(data));
}

function hasAdBlog(item) {
  return (
    isObject(item) &&
    isObject(item.data) &&
    (isAdData(item.data) || isAdData(item.data.blog))
  );
}

function isFollowControl(item) {
  if (!isObject(item)) {
    return false;
  }

  return (
    item.type === "follow" ||
    item.type === "mblog_menus_follow" ||
    item.type === "mblog_menus_special_follow" ||
    item.type === "mblog_menus_unfollow" ||
    item.type === "mblog_menus_remove_special_follow" ||
    item.name === FOLLOW_TEXT ||
    item.title === FOLLOW_TEXT
  );
}

function shouldDropItem(item) {
  if (!isObject(item)) {
    return false;
  }

  return (
    isFollowControl(item) ||
    item.category === "ad" ||
    item.type === "ad" ||
    item.commentAdType !== undefined ||
    item.commentAdSubType !== undefined ||
    isAdData(item.data) ||
    (!item.data && isAdData(item)) ||
    hasAdBlog(item)
  );
}

function cleanArray(items) {
  const result = [];

  items.forEach(function (item) {
    const cleaned = cleanNode(item);
    if (!shouldDropItem(cleaned)) {
      result.push(cleaned);
    }
  });

  return result;
}

function patchUser(user) {
  if (!isObject(user)) {
    return;
  }

  if (user.svip !== undefined) {
    user.svip = 0;
  }
  if (user.vvip !== undefined) {
    user.vvip = 0;
  }
  if (user.mbtype !== undefined) {
    user.mbtype = 0;
  }
  if (user.mbrank !== undefined) {
    user.mbrank = 0;
  }
  if (user.verified_type !== undefined) {
    user.verified_type = 0;
  }
  if (user.verified_type_ext !== undefined) {
    user.verified_type_ext = 0;
  }
  if (user.verified_detail !== undefined) {
    user.verified_detail = {};
  }
  if (user.verified_reason !== undefined) {
    user.verified_reason = "";
  }
  if (user.ability_tags !== undefined) {
    user.ability_tags = "";
  }

  if (isObject(user.avatar_extend_info) && user.avatar_extend_info.pendant_url_new !== undefined) {
    user.avatar_extend_info.pendant_url_new = "";
  }

  if (Array.isArray(user.icons)) {
    user.icons = user.icons.filter(function (icon) {
      return !(isObject(icon) && icon.type === "vip");
    });
  }
}

function patchNode(node) {
  if (!isObject(node)) {
    return;
  }

  if (node.pic_bg_new !== undefined) {
    node.pic_bg_new = "";
  }
  if (Array.isArray(node.topic_struct)) {
    node.topic_struct = [];
  }
  if (Array.isArray(node.buttons)) {
    node.buttons = node.buttons.filter(function (button) {
      return !isFollowControl(button);
    });
  }
  if (isObject(node.user)) {
    patchUser(node.user);
  }
}

function cleanNode(node) {
  if (Array.isArray(node)) {
    return cleanArray(node);
  }

  if (!isObject(node)) {
    return node;
  }

  Object.keys(node).forEach(function (key) {
    const value = node[key];
    if (Array.isArray(value)) {
      node[key] = cleanArray(value);
    } else if (isObject(value)) {
      node[key] = cleanNode(value);
    }
  });

  patchNode(node);
  return node;
}

function cleanWeiboDetailCommentBody(bodyText) {
  const json = JSON.parse(bodyText);
  return JSON.stringify(cleanNode(json));
}

if (typeof $done === "function") {
  const body = (typeof $response !== "undefined" && $response && $response.body) || "";

  try {
    $done({ body: cleanWeiboDetailCommentBody(body) });
  } catch (error) {
    console.log("weibo_detail_comment_clean error: " + error);
    $done({ body: body });
  }
}
