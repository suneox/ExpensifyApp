import useDebouncedState from "@hooks/useDebouncedState";
import addViewportResizeListener from "@libs/VisualViewport";
import CONST from "@src/CONST";
import { useEffect, useRef } from "react";

export default function useViewportOffsetTop(shouldAdjustScrollView = false): number {
  const [, viewportOffsetTop, setViewportOffsetTop] = useDebouncedState(0, CONST.TIMING.VIEWPORT_DEBOUNCE_TIME);
  const initialHeight = useRef(window.visualViewport?.height ?? window.innerHeight).current;
  const cachedDefaultOffsetTop = useRef<number>(0)
  useEffect(() => {
    const updateDimensions = (event: Event) => {
      const targetOffsetTop = (event.target instanceof VisualViewport && event.target.offsetTop) || 0;
      if (window.visualViewport) {
        const adjustScrollY = Math.round(initialHeight - window.visualViewport.height);
        if (cachedDefaultOffsetTop.current === 0) {
          cachedDefaultOffsetTop.current = targetOffsetTop;
        }

        if (adjustScrollY > targetOffsetTop) {
          setViewportOffsetTop(adjustScrollY);
        } else if (targetOffsetTop !== 0 && adjustScrollY === targetOffsetTop) {
          setViewportOffsetTop(cachedDefaultOffsetTop.current);
        } else {
          setViewportOffsetTop(targetOffsetTop);
        }
      }
    };

    const removeViewportResizeListener = addViewportResizeListener(updateDimensions);

    return () => {
      removeViewportResizeListener();
    };
  }, []);

  useEffect(() => {
    if (!shouldAdjustScrollView) {
      return;
    }
    window.scrollTo({ top: viewportOffsetTop });
  }, [shouldAdjustScrollView, viewportOffsetTop])

  return viewportOffsetTop;
}