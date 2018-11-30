(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports);
    global.bodyScrollLock = mod.exports;
  }
})(this, function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  var isIosDevice = typeof window !== 'undefined' && window.navigator && window.navigator.platform && /iPad|iPhone|iPod|(iPad Simulator)|(iPhone Simulator)|(iPod Simulator)/.test(window.navigator.platform);
  // Adopted and modified solution from Bohdan Didukh (2017)
  // https://stackoverflow.com/questions/41594997/ios-10-safari-prevent-scrolling-behind-a-fixed-overlay-and-maintain-scroll-posi

  var firstTargetElement = null;
  var allTargetElements = [];
  var initialClientY = -1;
  var previousBodyOverflowSetting = void 0;
  var previousDocumentElementOverflowSetting = void 0;
  var previousBodyPaddingRight = void 0;

  var preventDefault = function preventDefault(rawEvent) {
    var e = rawEvent || window.event;
    if (e.preventDefault) e.preventDefault();

    return false;
  };

  var setOverflowHidden = function setOverflowHidden(options) {
    // Setting overflow on body/documentElement synchronously in Desktop Safari slows down
    // the responsiveness for some reason. Setting within a setTimeout fixes this.
    setTimeout(function () {
      // If previousBodyPaddingRight is already set, don't set it again.
      if (previousBodyPaddingRight === undefined) {
        var _reserveScrollBarGap = !!options && options.reserveScrollBarGap === true;
        var scrollBarGap = window.innerWidth - document.documentElement.clientWidth;

        if (_reserveScrollBarGap && scrollBarGap > 0) {
          previousBodyPaddingRight = document.body.style.paddingRight;
          document.body.style.paddingRight = scrollBarGap + 'px';
        }
      }

      // If previousBodyOverflowSetting is already set, don't set it again.
      if (previousBodyOverflowSetting === undefined) {
        previousBodyOverflowSetting = document.body.style.overflow;
        previousDocumentElementOverflowSetting = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }
    });
  };

  var restoreOverflowSetting = function restoreOverflowSetting() {
    // Setting overflow on body/documentElement synchronously in Desktop Safari slows down
    // the responsiveness for some reason. Setting within a setTimeout fixes this.
    setTimeout(function () {
      if (previousBodyPaddingRight !== undefined) {
        document.body.style.paddingRight = previousBodyPaddingRight;

        // Restore previousBodyPaddingRight to undefined so setOverflowHidden knows it
        // can be set again.
        previousBodyPaddingRight = undefined;
      }

      if (previousBodyOverflowSetting !== undefined) {
        document.body.style.overflow = previousBodyOverflowSetting;
        document.documentElement.style.overflow = previousDocumentElementOverflowSetting;

        // Restore previousBodyOverflowSetting/previousDocumentElementOverflowSetting to undefined
        // so setOverflowHidden knows it can be set again.
        previousBodyOverflowSetting = undefined;
        previousDocumentElementOverflowSetting = undefined;
      }
    });
  };

  // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#Problems_and_solutions
  var isTargetElementTotallyScrolled = function isTargetElementTotallyScrolled(targetElement) {
    return targetElement ? targetElement.scrollHeight - targetElement.scrollTop <= targetElement.clientHeight : false;
  };

  var handleScroll = function handleScroll(event, targetElement) {
    var clientY = event.targetTouches[0].clientY - initialClientY;

    if (targetElement && targetElement.scrollTop === 0 && clientY > 0) {
      // element is at the top of its scroll
      return preventDefault(event);
    }

    if (isTargetElementTotallyScrolled(targetElement) && clientY < 0) {
      // element is at the top of its scroll
      return preventDefault(event);
    }

    return true;
  };

  var handlers = new Map();

  var disableBodyScroll = exports.disableBodyScroll = function disableBodyScroll(targetElement, options) {
    if (isIosDevice) {
      // targetElement must be provided, and disableBodyScroll must not have been
      // called on this targetElement before.
      if (targetElement && !allTargetElements.includes(targetElement)) {
        allTargetElements = [].concat(_toConsumableArray(allTargetElements), [targetElement]);

        handlers.set(targetElement, function (event) {
          if (!targetElement.contains(event.target)) {
            event.preventDefault();
          }
        });

        document.body.addEventListener('touchstart', handlers.get(targetElement), {
          passive: false
        });
        document.body.addEventListener('touchmove', handlers.get(targetElement), {
          passive: false
        });

        targetElement.ontouchstart = function (event) {
          if (event.targetTouches.length === 1) {
            // detect single touch
            initialClientY = event.targetTouches[0].clientY;
          }
        };
        targetElement.ontouchmove = function (event) {
          if (event.targetTouches.length === 1) {
            // detect single touch
            handleScroll(event, targetElement);
          }
        };
      }
    } else {
      setOverflowHidden(options);
    }

    if (!firstTargetElement) firstTargetElement = targetElement;
  };

  var clearAllBodyScrollLocks = exports.clearAllBodyScrollLocks = function clearAllBodyScrollLocks() {
    if (isIosDevice) {
      handlers.forEach(function (handler) {
        document.body.removeEventListener('touchstart', handler);
        document.body.removeEventListener('touchmove', handler);
      });
      handlers.clear();

      // Clear all allTargetElements ontouchstart/ontouchmove handlers, and the references
      allTargetElements.forEach(function (targetElement) {
        targetElement.ontouchstart = null;
        targetElement.ontouchmove = null;

        allTargetElements = [];
      });

      // Reset initial clientY
      initialClientY = -1;
    } else {
      restoreOverflowSetting();
    }

    firstTargetElement = null;
  };

  var enableBodyScroll = exports.enableBodyScroll = function enableBodyScroll(targetElement) {
    if (isIosDevice) {
      allTargetElements.forEach(function (target) {
        if (targetElement === target) {
          document.body.removeEventListener('touchstart', handlers.get(targetElement));
          document.body.removeEventListener('touchmove', handlers.get(targetElement));
          handlers.delete(targetElement);

          if (targetElement === firstTargetElement) {
            firstTargetElement = null;
          }
        }
      });

      targetElement.ontouchstart = null;
      targetElement.ontouchmove = null;

      allTargetElements = allTargetElements.filter(function (elem) {
        return elem !== targetElement;
      });
    } else if (firstTargetElement === targetElement) {
      restoreOverflowSetting();
      firstTargetElement = null;
    }
  };
});

