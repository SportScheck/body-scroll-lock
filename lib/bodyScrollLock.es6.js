

const isIosDevice = typeof window !== 'undefined' && window.navigator && window.navigator.platform && /iPad|iPhone|iPod|(iPad Simulator)|(iPhone Simulator)|(iPod Simulator)/.test(window.navigator.platform);
// Adopted and modified solution from Bohdan Didukh (2017)
// https://stackoverflow.com/questions/41594997/ios-10-safari-prevent-scrolling-behind-a-fixed-overlay-and-maintain-scroll-posi

let firstTargetElement = null;
let allTargetElements = [];
let initialClientY = -1;
let previousBodyOverflowSetting;
let previousDocumentElementOverflowSetting;
let previousBodyPaddingRight;

const preventDefault = rawEvent => {
  const e = rawEvent || window.event;
  if (e.preventDefault) e.preventDefault();

  return false;
};

const setOverflowHidden = options => {
  // Setting overflow on body/documentElement synchronously in Desktop Safari slows down
  // the responsiveness for some reason. Setting within a setTimeout fixes this.
  setTimeout(() => {
    // If previousBodyPaddingRight is already set, don't set it again.
    if (previousBodyPaddingRight === undefined) {
      const reserveScrollBarGap = !!options && options.reserveScrollBarGap === true;
      const scrollBarGap = window.innerWidth - document.documentElement.clientWidth;

      if (reserveScrollBarGap && scrollBarGap > 0) {
        previousBodyPaddingRight = document.body.style.paddingRight;
        document.body.style.paddingRight = `${scrollBarGap}px`;
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

const restoreOverflowSetting = () => {
  // Setting overflow on body/documentElement synchronously in Desktop Safari slows down
  // the responsiveness for some reason. Setting within a setTimeout fixes this.
  setTimeout(() => {
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
const isTargetElementTotallyScrolled = targetElement => targetElement ? targetElement.scrollHeight - targetElement.scrollTop <= targetElement.clientHeight : false;

const handleScroll = (event, targetElement) => {
  const clientY = event.targetTouches[0].clientY - initialClientY;

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

const handlers = new Map();

export const disableBodyScroll = (targetElement, options) => {
  if (isIosDevice) {
    // targetElement must be provided, and disableBodyScroll must not have been
    // called on this targetElement before.
    if (targetElement && !allTargetElements.includes(targetElement)) {
      allTargetElements = [...allTargetElements, targetElement];

      handlers.set(targetElement, event => {
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

      targetElement.ontouchstart = event => {
        if (event.targetTouches.length === 1) {
          // detect single touch
          initialClientY = event.targetTouches[0].clientY;
        }
      };
      targetElement.ontouchmove = event => {
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

export const clearAllBodyScrollLocks = () => {
  if (isIosDevice) {
    handlers.forEach(handler => {
      document.body.removeEventListener('touchstart', handler);
      document.body.removeEventListener('touchmove', handler);
    });
    handlers.clear();

    // Clear all allTargetElements ontouchstart/ontouchmove handlers, and the references
    allTargetElements.forEach(targetElement => {
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

export const enableBodyScroll = targetElement => {
  if (isIosDevice) {
    allTargetElements.forEach(target => {
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

    allTargetElements = allTargetElements.filter(elem => elem !== targetElement);
  } else if (firstTargetElement === targetElement) {
    restoreOverflowSetting();
    firstTargetElement = null;
  }
};

