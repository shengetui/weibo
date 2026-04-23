/*
Weibo feed ad cleaner for Quantumult X.

Use this script as script-response-body on Weibo JSON feed endpoints. It removes
visible ad cards/posts while leaving normal posts and comments intact.
*/

const AD_TEXT = "\u5e7f\u544a";
const HOT_CHANNEL_TITLE = "\u70ed\u70b9";
const COMMENT_TEXT = "\u8bc4\u8bba";
const FOLLOW_TEXT = "\u5173\u6ce8";
const RESIDUAL_AD_HOTWORDS = [
  "\u4f59\u627f\u4e1c\u7206\u6599\u9e3f\u8499\u5ea7\u8231\u5c06\u8de8\u4ee3\u5347\u7ea7",
  "\u5c1a\u754cZ7\u5927\u5b9a27\u5206\u949f\u783412000\u53f0",
  "\u4e0a\u6c7d\u603b\u88c1\u9e3f\u8499\u667a\u884c\u53d1\u5e03\u4f1a\u5f55\u64ad"
];
const RESIDUAL_AD_KEYWORDS = [
  "\u591c\u5df4\u9ece",
  "\u6d4e\u5357\u4f18\u5316\u516c\u79ef\u91d1\u8d37\u6b3e",
  "\u5e02\u76d1\u6240\u56de\u5e943\u53ea\u8001\u9f20\u5543\u98df\u751f\u9c7c"
];

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

function textHasAdMarker(text) {
  if (!text) {
    return false;
  }

  return (
    /(?:^|[|&?])adid(?::|=|%3D)\d+/i.test(text) ||
    /(?:^|[|&?])ads_word:/i.test(text) ||
    /(?:^|[|&?])cate_type:ads_hotword/i.test(text) ||
    /(?:^|[|&?])is_ad_pos(?::|=|%3D)1/i.test(text) ||
    /(?:^|[|&?])source(?::|=|%3D)is_ad/i.test(text) ||
    /(?:^|[|&?])source:ad(?:$|[|&])/i.test(text) ||
    /(?:^|[|&?])topic_ad(?:=|%3D)1/i.test(text) ||
    /reallog_mark_ad/i.test(text) ||
    /ad_video_/i.test(text) ||
    /third_party_monitor_url/i.test(text) ||
    /kadmimage\.biz\.weibo\.com/i.test(text) ||
    /ad\.us\.sinaimg\.cn/i.test(text)
  );
}

function actionLogText(data) {
  const parts = [];

  if (!isObject(data)) {
    return "";
  }

  parts.push(stringValue(data.itemid));
  parts.push(stringValue(data.analysis_extra));
  parts.push(stringValue(data.scheme));
  parts.push(stringValue(data.ext));
  parts.push(stringValue(data.mark));
  parts.push(stringValue(data.readtimetype));

  if (isObject(data.action_log)) {
    parts.push(stringValue(data.action_log.ext));
  }
  if (isObject(data.actionlog)) {
    parts.push(stringValue(data.actionlog.ext));
  }
  if (isObject(data.video_actionlog)) {
    parts.push(stringValue(data.video_actionlog.ext));
    parts.push(stringValue(data.video_actionlog.mark));
    parts.push(stringValue(data.video_actionlog.source));
  }
  if (isObject(data.page_info) && isObject(data.page_info.ad_click_actionlog)) {
    parts.push("ad_click_actionlog");
    parts.push(stringValue(data.page_info.ad_click_actionlog.ext));
    parts.push(stringValue(data.page_info.ad_click_actionlog.mark));
    parts.push(stringValue(data.page_info.ad_click_actionlog.source));
  }
  if (isObject(data.ad_videoinfo)) {
    parts.push("ad_videoinfo");
  }
  if (isObject(data.corner_mark_data)) {
    parts.push(stringValue(data.corner_mark_data.title));
  }

  return parts.join("|");
}

function getLogField(text, key) {
  if (!text) {
    return "";
  }

  const match = text.match(new RegExp("(?:^|[|&?])" + key + ":([^|&]*)", "i"));
  return match ? match[1] : "";
}

function isFinderInjectedHotword(data) {
  const text = actionLogText(data);
  const cateType = getLogField(text, "cate_type").toLowerCase();

  return (
    cateType !== "" &&
    cateType !== "hotword" &&
    /(?:^|[|&?])mod_src:s_finder(?:$|[|&])/i.test(text) &&
    /(?:^|[|&?])hot_word:/i.test(text)
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

function isResidualHotwordAd(data) {
  if (!isObject(data)) {
    return false;
  }

  const title = stringValue(data.title_sub) || stringValue(data.title);
  const text = [
    title,
    stringValue(data.text),
    stringValue(data.itemid),
    stringValue(data.scheme),
    isObject(data.action_log) ? stringValue(data.action_log.ext) : ""
  ].join("|");

  if (RESIDUAL_AD_HOTWORDS.indexOf(title) !== -1) {
    return true;
  }

  if (isFinderInjectedHotword(data)) {
    return true;
  }

  if (/cate_type:tongcheng/i.test(text) && /rawhot:0,0/i.test(text)) {
    return true;
  }

  for (let i = 0; i < RESIDUAL_AD_KEYWORDS.length; i++) {
    if (text.indexOf(RESIDUAL_AD_KEYWORDS[i]) !== -1) {
      return true;
    }
  }

  return false;
}

function isFinderTopicHeaderCard(data) {
  if (!isObject(data)) {
    return false;
  }

  if (data.card_type !== 101) {
    return false;
  }

  return (
    data.cate_id === "1121" ||
    stringValue(data.itemid).indexOf("cate=1121") !== -1 ||
    stringValue(data.analysis_extra).indexOf("cate=1121") !== -1
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
    data.insert_ad_feed === 1 ||
    data.adType !== undefined ||
    data.adid !== undefined
  ) {
    return true;
  }

  if (data.mblogtypename === AD_TEXT || data.readtimetype === "adMblog") {
    return true;
  }

  if (data.itemid === "finder_window" || data.itemid === "finder_channel" || data.card_type === 118) {
    return true;
  }

  if (isResidualHotwordAd(data)) {
    return true;
  }

  if (isFinderTopicHeaderCard(data)) {
    return true;
  }

  if (data.card_type === 17 && Array.isArray(data.group) && data.group.length === 0) {
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

  if (isObject(data.corner_mark_data) && data.corner_mark_data.title === AD_TEXT) {
    return true;
  }

  if (isAdPromotion(data.promotion)) {
    return true;
  }

  return textHasAdMarker(actionLogText(data));
}

function shouldDropItem(item) {
  if (!isObject(item)) {
    return false;
  }

  if (isFollowControl(item)) {
    return true;
  }

  if (item.category === "ad" || item.type === "ad") {
    return true;
  }

  if (item.commentAdType !== undefined || item.commentAdSubType !== undefined) {
    return true;
  }

  if (item.category === "group" && Array.isArray(item.items) && item.items.length === 0) {
    return true;
  }

  if (isAdData(item.data)) {
    return true;
  }

  if (!item.data && isAdData(item)) {
    return true;
  }

  return false;
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

function patchPagingParams(params) {
  if (!isObject(params)) {
    return;
  }

  if (params.preAdInterval !== undefined) {
    params.preAdInterval = 999;
  }
  if (params.lastAdInterval !== undefined) {
    params.lastAdInterval = 999;
  }
  if (params.adInterval !== undefined) {
    params.adInterval = 999;
  }
  if (params.need_ad !== undefined) {
    params.need_ad = 0;
  }
  if (params.insert_ad !== undefined) {
    params.insert_ad = 0;
  }
}

function patchMblogData(data) {
  if (!isObject(data)) {
    return;
  }

  if (data.ad_tag_nature !== undefined) {
    delete data.ad_tag_nature;
  }

  if (data.title !== undefined && isFinderTopicHeaderCard(data)) {
    data.title = "";
    if (data.desc !== undefined) {
      data.desc = "";
    }
  }

  if (Array.isArray(data.topic_struct)) {
    data.topic_struct = [];
  }

  if (data.pic_bg_new !== undefined) {
    data.pic_bg_new = "";
  }

  if (Array.isArray(data.buttons)) {
    data.buttons = data.buttons.filter(function (button) {
      return !isFollowControl(button);
    });
  }

  if (Array.isArray(data.mblog_buttons)) {
    data.mblog_buttons = data.mblog_buttons.filter(function (button) {
      if (!isObject(button)) {
        return false;
      }

      return (
        stringValue(button.type).indexOf("comment") !== -1 ||
        button.name === COMMENT_TEXT ||
        button.title === COMMENT_TEXT
      );
    });
  }

  if (isObject(data.user)) {
    if (data.user.svip !== undefined) {
      data.user.svip = 0;
    }
    if (data.user.vvip !== undefined) {
      data.user.vvip = 0;
    }
    if (data.user.mbtype !== undefined) {
      data.user.mbtype = 0;
    }
    if (data.user.mbrank !== undefined) {
      data.user.mbrank = 0;
    }
    if (data.user.verified_type !== undefined) {
      data.user.verified_type = 0;
    }
    if (data.user.verified_type_ext !== undefined) {
      data.user.verified_type_ext = 0;
    }
    if (data.user.verified_detail !== undefined) {
      data.user.verified_detail = {};
    }
    if (data.user.verified_reason !== undefined) {
      data.user.verified_reason = "";
    }

    if (data.user.ability_tags !== undefined) {
      data.user.ability_tags = "";
    }

    if (isObject(data.user.avatar_extend_info) && data.user.avatar_extend_info.pendant_url_new !== undefined) {
      data.user.avatar_extend_info.pendant_url_new = "";
    }

    if (Array.isArray(data.user.icons)) {
      data.user.icons = data.user.icons.filter(function (icon) {
        return !(isObject(icon) && icon.type === "vip");
      });
    }
  }
}

function patchFinderChannelInfo(channelInfo) {
  if (!isObject(channelInfo)) {
    return;
  }

  if (isObject(channelInfo.channelConfig) && channelInfo.channelConfig.auto_refresh_config !== undefined) {
    delete channelInfo.channelConfig.auto_refresh_config;
  }

  if (Array.isArray(channelInfo.channels) && channelInfo.channels.length > 1) {
    let hotChannel = null;

    for (let i = 0; i < channelInfo.channels.length; i++) {
      if (channelInfo.channels[i] && channelInfo.channels[i].title === HOT_CHANNEL_TITLE) {
        hotChannel = channelInfo.channels[i];
        break;
      }
    }

    channelInfo.channels = [hotChannel || channelInfo.channels[0]];
  }
}

function patchMeta(node) {
  if (!isObject(node)) {
    return;
  }

  patchMblogData(node);

  if (node.searchbar_exist_ad !== undefined) {
    node.searchbar_exist_ad = 0;
  }
  if (Array.isArray(node.searchBarContent)) {
    node.searchBarContent = [];
  }
  if (isObject(node.headerBack) && node.headerBack.channelStyleMap !== undefined) {
    delete node.headerBack.channelStyleMap;
  }
  if (node.foreground_req_preload !== undefined) {
    node.foreground_req_preload = false;
  }
  if (node.last_ad_show_interval !== undefined) {
    node.last_ad_show_interval = 86400;
  }
  if (isObject(node.params)) {
    patchPagingParams(node.params);
  }
  if (isObject(node.channelInfo)) {
    patchFinderChannelInfo(node.channelInfo);
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

  patchMeta(node);
  return node;
}

function cleanWeiboBody(bodyText) {
  const json = JSON.parse(bodyText);
  return JSON.stringify(cleanNode(json));
}

if (typeof $done === "function") {
  const body = (typeof $response !== "undefined" && $response && $response.body) || "";

  try {
    $done({ body: cleanWeiboBody(body) });
  } catch (error) {
    console.log("weibo_feed_clean error: " + error);
    $done({ body: body });
  }
}
