import React, { useState, useEffect, useRef } from "react";
import './TimeWindowSlider.css';

const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches;

const TimeWindowSlider = ({ onFilterChange, colorOwner = 'time' }) => {
  // Starting date: June 1, 2020.
  const startDate = new Date(2020, 5, 1);
  const currentDate = new Date();

  // Calculate total days, months, and years.
  const totalDays = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
  const totalMonths =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
    (currentDate.getMonth() - startDate.getMonth()) + 1;
  const totalYears = currentDate.getFullYear() - startDate.getFullYear() + 1;

  // Local state: zoom level and view offset.
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [viewOffset, setViewOffset] = useState(1.0);

  // Determine mode.
  const isDayViewMode = zoomLevel < 0.04;
  const isWeekMode    = !isDayViewMode && zoomLevel < 0.15;
  const isYearMode    = zoomLevel >= 0.95; // Fully zoomed out = year mode.
  
  // Slow interaction constants.
  const DRAG_SLOW_FACTOR = isDayViewMode ? 0.1 : 2.0; // Faster speed for both modes
  const ZOOM_SLOW_FACTOR_DAY = 0.001;
  const ZOOM_SLOW_FACTOR_OTHER = 0.005;

  // Refs for dragging.
  const sliderRef = useRef(null);
  const trackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

  // Single professional color for the slider
  function getProfessionalColor() {
    return "#de2d08"; // More vibrant reddish-orange tone
  }

  // Calculate visible range based on current mode.
  const calculateVisibleRange = () => {
    if (isDayViewMode) {
      const minDays = 3;
      const maxDays = 30;
      let normalized = (zoomLevel - 0.01) / (0.1 - 0.01);
      normalized = Math.max(0, Math.min(1, normalized));
      const daysToShow = Math.round(minDays + normalized * (maxDays - minDays));
      const maxOffset = Math.max(0, totalDays - daysToShow+1);
      const dayOffset = Math.round(viewOffset * maxOffset);
      const firstVisibleDate = new Date(startDate);
      firstVisibleDate.setDate(startDate.getDate() + dayOffset);
      const lastVisibleDate = new Date(firstVisibleDate);
      lastVisibleDate.setDate(firstVisibleDate.getDate() + daysToShow - 1);
      if (lastVisibleDate > currentDate) {
        lastVisibleDate.setTime(currentDate.getTime());
      }
      return { firstVisibleDate, lastVisibleDate, isDayView: true };
    } else if (isWeekMode) {
      // Weeks mode: 4 → 3 → 2 → 1 week(s) as you zoom in
        const weeksToShow =
          zoomLevel < 0.06 ? 1 :
          zoomLevel < 0.09 ? 2 :
          zoomLevel < 0.12 ? 3 : 4;
       const daysToShow = weeksToShow * 7;
        const maxOffset = Math.max(0, totalDays - daysToShow + 1);
        const dayOffset = Math.round(viewOffset * maxOffset);
        const firstVisibleDate = new Date(startDate);
        firstVisibleDate.setDate(startDate.getDate() + dayOffset);
        const lastVisibleDate = new Date(firstVisibleDate);
        lastVisibleDate.setDate(firstVisibleDate.getDate() + daysToShow - 1);
        if (lastVisibleDate > currentDate) {
          lastVisibleDate.setTime(currentDate.getTime());
        }
        return { firstVisibleDate, lastVisibleDate, isWeekMode: true };
      	} else if (isYearMode) {
		// Year mode: show the full range June 2020 → today,
		// but still express it in terms of months so dividers line up correctly.
		const visibleMonths = totalMonths;
		const firstVisibleMonthIndex = 0;
		const firstVisibleDate = new Date(startDate);
		const lastVisibleDate  = new Date(currentDate);

		return {
			firstVisibleDate,
			lastVisibleDate,
			visibleMonths,
			isDayView: false,
			isYearMode: true,
			firstVisibleMonthIndex,
			lastVisibleMonthIndex: firstVisibleMonthIndex + visibleMonths - 1,
		};
	} else {
		// months mode...

      // Months mode: continuous mapping from zoom → span (no jump from years)
      const visibleMonths = Math.max(
        1,
        Math.min(totalMonths, Math.round(totalMonths * zoomLevel))
      );
      const maxOffset = Math.max(0, totalMonths - visibleMonths);
      const firstVisibleMonthIndex = Math.round(viewOffset * maxOffset);
      const firstVisibleDate = new Date(startDate);
      firstVisibleDate.setMonth(startDate.getMonth() + firstVisibleMonthIndex);
      const lastVisibleDate = new Date(firstVisibleDate);
      lastVisibleDate.setMonth(firstVisibleDate.getMonth() + visibleMonths - 1);
      const lastDay = new Date(lastVisibleDate.getFullYear(), lastVisibleDate.getMonth() + 1, 0).getDate();
      lastVisibleDate.setDate(lastDay);
      if (lastVisibleDate > currentDate) {
        lastVisibleDate.setTime(currentDate.getTime());
      }
      return {
        firstVisibleDate,
        lastVisibleDate,
        visibleMonths,
        isDayView: false,
        firstVisibleMonthIndex,
        lastVisibleMonthIndex: firstVisibleMonthIndex + visibleMonths - 1,
      };
    }
  };

  // Format date for display.
  const formatDateDisplay = (date) => {
    return isDayViewMode
      ? `${date.getDate()} ${date.toLocaleString("default", { month: "short" })} ${date.getFullYear()}`
      : `${date.toLocaleString("default", { month: "short" })} ${date.getFullYear()}`;
  };

  const formatDateRangeDisplay = () => {
		const range = calculateVisibleRange();
		const { firstVisibleDate, lastVisibleDate } = range;

		const fmtDay = (date) =>
			`${date.getDate()} ${date.toLocaleString("default", {
				month: "short",
			})} ${date.getFullYear()}`;

		const fmtMonth = (date) =>
			`${date.toLocaleString("default", {
				month: "short",
			})} ${date.getFullYear()}`;

		// Use full day–month–year whenever we are in a view that shows days
		const useDayPrecision = range.isDayView || range.isWeekMode;
		const f = useDayPrecision ? fmtDay : fmtMonth;

		return `${f(firstVisibleDate)} to ${f(lastVisibleDate)}`;
	};


  // Debounced parent update.
  const updateParentWithCurrentRange = () => {
    const range = calculateVisibleRange();
    if (range.isDayView || range.isWeekMode) {
      onFilterChange(
        range.firstVisibleDate.getFullYear(),
        range.firstVisibleDate.getMonth() + 1,
        range.lastVisibleDate.getFullYear(),
        range.lastVisibleDate.getMonth() + 1,
        range.firstVisibleDate.getDate(),
        range.lastVisibleDate.getDate()
      );
    } else if (range.isYearMode) {
      onFilterChange(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      );
    } else {
      onFilterChange(
        range.firstVisibleDate.getFullYear(),
        range.firstVisibleDate.getMonth() + 1,
        range.lastVisibleDate.getFullYear(),
        range.lastVisibleDate.getMonth() + 1
      );
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      updateParentWithCurrentRange();
    }, 200);
    return () => clearTimeout(handler);
  }, [viewOffset, zoomLevel]);

  useEffect(() => {
    updateParentWithCurrentRange();
  }, []);

  // Drag handlers.
  const handleMouseDown = (e) => {
    if (!trackRef.current) return;
    
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = viewOffset;
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    trackRef.current.classList.add("dragging");
    e.preventDefault(); // Prevent text selection during drag
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    
    const trackWidth = trackRef.current.offsetWidth;
    const deltaX = e.clientX - dragStartXRef.current;
    
    // Apply sensitivity factor - adjusted for faster dragging
    let sensitivityFactor = isDayViewMode ? 0.1 : 2.0;
    
    // Calculate new offset - negative because moving right means going to earlier dates
    const deltaRatio = (-deltaX / trackWidth) * sensitivityFactor;
    const newOffset = Math.max(0, Math.min(1, dragStartOffsetRef.current + deltaRatio));
    
    setViewOffset(newOffset);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    
    if (trackRef.current) {
      trackRef.current.classList.remove("dragging");
    }
  };

  // Zoom handler – smooth, no big jumps, anchored to cursor in month mode
  const handleWheel = (e) => {
    e.preventDefault();

    if (!trackRef.current) {
      // Fallback: keep old behaviour if track is missing
      const raw = e.deltaY;
      const clamped = Math.max(-60, Math.min(60, raw));
      const k = zoomLevel < 0.1 ? 0.004 : 0.008;
      const scale = Math.exp(clamped * k);
      const newZoomLevel = Math.max(0.01, Math.min(1.0, zoomLevel * scale));
      setZoomLevel(newZoomLevel);
      if (newZoomLevel >= 1.0) {
        setViewOffset(1.0);
      }
      return;
    }

    const rect = trackRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorRatio = Math.max(0, Math.min(1, cursorX / rect.width || 0)); // 0–1

    // === 1) Compute new zoom level (same logic as before) ===
    const raw = e.deltaY;
    const clamped = Math.max(-60, Math.min(60, raw));
    const k = zoomLevel < 0.1 ? 0.004 : 0.008; // gentler in day/close zoom
    const scale = Math.exp(clamped * k);

    const oldZoom = zoomLevel;
    const newZoom = Math.max(0.01, Math.min(1.0, zoomLevel * scale));

    // === 2) MONTH MODE: do proper month math to avoid big jumps ===
    if (!isDayViewMode && !isWeekMode && !isYearMode) {
      // Use current visible month range from our helper
      const range = calculateVisibleRange();
      const N = totalMonths; // total months from June 2020 → now

      const Mold = Math.max(
        1,
        Math.min(N, range.visibleMonths || Math.round(totalMonths * oldZoom))
      );
      const i0old = range.firstVisibleMonthIndex || 0; // leftmost visible month index

      // Absolute month index under the cursor before zoom
      const iUnderCursor = i0old + cursorRatio * Mold;

      // New visible months from zoom level
      const Mnew = Math.max(
        1,
        Math.min(N, Math.round(totalMonths * newZoom))
      );
      const maxOffsetIdx = Math.max(0, N - Mnew);

      // New left index so that the same absolute month stays under the cursor
      let i0new = iUnderCursor - cursorRatio * Mnew;
      i0new = Math.max(0, Math.min(maxOffsetIdx, i0new));

      // Convert back to viewOffset in [0, 1]
      const newViewOffset =
        maxOffsetIdx > 0 ? i0new / maxOffsetIdx : 0;

      setZoomLevel(newZoom);
      setViewOffset(newViewOffset);
      return;
    }

    // === 3) DAY / WEEK / YEAR MODES: keep behaviour similar to before ===
    const absolutePoint = viewOffset + cursorRatio * oldZoom;
    let newOffset = absolutePoint - cursorRatio * newZoom;

    if (newZoom >= 1.0) {
      newOffset = 1.0;
    }

    newOffset = Math.max(0, Math.min(1, newOffset));
    setZoomLevel(newZoom);
    setViewOffset(newOffset);
  };




  useEffect(() => {
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (slider) {
        slider.removeEventListener("wheel", handleWheel);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [zoomLevel, viewOffset, isDayViewMode]);

  // Touch drag support (mobile)
  const handleTouchStart = (e) => {
    if (!trackRef.current) return;
    const t = e.touches[0];
    isDraggingRef.current = true;
    dragStartXRef.current = t.clientX;
    dragStartOffsetRef.current = viewOffset;
    trackRef.current.classList.add("dragging");
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const t = e.touches[0];
    const trackWidth = trackRef.current.offsetWidth;
    const deltaX = t.clientX - dragStartXRef.current;

    const sensitivityFactor = isDayViewMode ? 0.1 : 2.0;
    const deltaRatio = (-deltaX / trackWidth) * sensitivityFactor;
    const newOffset = Math.max(0, Math.min(1, dragStartOffsetRef.current + deltaRatio));
    setViewOffset(newOffset);
    e.preventDefault(); // stop page scroll while dragging slider
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (trackRef.current) trackRef.current.classList.remove("dragging");
  };

  // Zoom buttons (mobile)
  const zoomIn = () => {
    // zoom in ⇒ smaller zoomLevel (more detail)
    setZoomLevel(prev => {
      const next = Math.max(0.01, prev * 0.8);
      if (next >= 1.0) setViewOffset(1.0);
      return next;
    });
  };

  const zoomOut = () => {
    // zoom out ⇒ larger zoomLevel (more span)
    setZoomLevel(prev => {
      const next = Math.min(1.0, prev * 1.25);
      if (next >= 1.0) setViewOffset(1.0);
      return next;
    });
  };

  // --- Divider Generation ---
	const generateDividers = () => {
		const dividers = [];
		const labels = [];
		const range = calculateVisibleRange();

		// --- 1) DAY / WEEK MODES (unchanged idea) ---------------------------
		if (range.isDayView || range.isWeekMode) {
			const { firstVisibleDate, lastVisibleDate } = range;
			const oneDay = 24 * 60 * 60 * 1000;
			const days =
				Math.ceil((lastVisibleDate - firstVisibleDate) / oneDay) + 1;
			const dividerDate = new Date(firstVisibleDate);

			// Only three day labels: left, center, right
			const labelIndices =
				days <= 3
					? [...Array(days).keys()]
					: [0, Math.floor((days - 1) / 2), days - 1];

			for (let i = 0; i < days; i++) {
				const pos = (i / Math.max(1, days - 1)) * 100;

				const isYearBoundary =
					dividerDate.getMonth() === 0 && dividerDate.getDate() === 1;

				dividers.push(
					<div
						key={`day-divider-${dividerDate.toISOString()}`}
						className={
							isYearBoundary
								? "divider divider-year"
								: "divider divider-day"
						}
						style={{ left: `${pos}%`, height: "100%", top: 0 }}
					/>
				);

				// Day labels at key positions
				if (labelIndices.includes(i)) {
					labels.push(
						<div
							key={`day-label-${dividerDate.toISOString()}`}
							className="day-label"
							style={{ left: `${pos}%` }}
						>
							{dividerDate.getDate()}
						</div>
					);
				}

				// Year label directly under 1 January
				if (isYearBoundary) {
					labels.push(
						<div
							key={`year-label-${dividerDate.getFullYear()}`}
							className="year-label"
							style={{ left: `${pos}%` }}
						>
							{dividerDate.getFullYear()}
						</div>
					);
				}

				dividerDate.setDate(dividerDate.getDate() + 1);
			}

			return { dividers, labels };
		}

		// --- 2) MONTH & YEAR MODES (shared, month-based axis) ---------------
		const visibleMonths = range.visibleMonths || 0;
		const firstVisibleMonthIndex = range.firstVisibleMonthIndex || 0;

		if (!visibleMonths) return { dividers, labels };

		const segments = visibleMonths; // N months → N equal boxes → N+1 boundaries

		for (let i = 0; i <= segments; i++) {
			const boundaryIndex = firstVisibleMonthIndex + i;

			// Map "month index from June 2020" → (year, month)
			const base = startDate.getMonth() + boundaryIndex;
			const year =
				startDate.getFullYear() + Math.floor(base / 12);
			const month = base % 12; // 0 = Jan ... 11 = Dec

			// Position of this boundary across the visible months [0..1]
			const pos = segments > 0 ? (i / segments) * 100 : 0;

			// Actual calendar date for the boundary (1st of that month)
			const boundaryDate = new Date(year, month, 1);

			// A year boundary is *only* a January 1st that lies inside the data window
			const isYearBoundary =
				month === 0 &&
				boundaryDate >= startDate &&
				boundaryDate <= currentDate;

			if (range.isYearMode) {
				// YEAR MODE: show ONLY bold year lines, no month lines.
				if (!isYearBoundary) continue;

				dividers.push(
					<div
						key={`year-boundary-${year}`}
						className="divider divider-year"
						style={{ left: `${pos}%`, height: "100%", top: 0 }}
					/>
				);

				labels.push(
					<div
						key={`year-label-${year}`}
						className="year-label"
						style={{ left: `${pos}%` }}
					>
						{year}
					</div>
				);
			} else {
				// MONTH MODE: thin month lines + bold year lines
				dividers.push(
					<div
						key={`month-boundary-${year}-${month + 1}`}
						className={
							isYearBoundary
								? "divider divider-year"
								: "divider divider-month"
						}
						style={{ left: `${pos}%`, height: "100%", top: 0 }}
					/>
				);

				if (isYearBoundary && i < segments) {
					labels.push(
						<div
							key={`year-label-${year}`}
							className="year-label"
							style={{ left: `${pos}%` }}
						>
							{year}
						</div>
					);
				}
			}
		}

		return { dividers, labels };
	};



  const { dividers, labels } = generateDividers();

  // --- Background Color ---
  function getTrackBackground() {
    // Twilight cyclic gradient (endpoints repeated for smooth wrap)
    return `linear-gradient(to right,
     #e2d9ff 0%,
     #bfa9f6 10%,
     #8d75cf 20%,
     #6a51a3 30%,
     #4b2f86 40%,
     #2d1a6f 50%,
     #23306f 60%,
     #2c557c 70%,
     #3f7d7a 80%,
     #68a56f 90%,
     #b7cf77 100%,
     #e2d9ff 100%
    )`;
  }

// let CSS classes control the background
const trackStyle = { cursor: "grab" };


  return (
    <div className={`time-window-slider-container ${isDayViewMode ? "day-view" : ""}`}>
      <div className="timeline-slider" ref={sliderRef}>
        <div
          className={`timeline-track ${colorOwner === 'magnitude' ? 'gray' : 'colored'}`}
          ref={trackRef}
          style={trackStyle}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {dividers}
        </div>

        {/* Labels under the track */}
        <div className={isDayViewMode ? "day-labels" : "year-labels"}>
          {labels}
        </div>

        {/* Zoom buttons only for mobile */}
        {isMobile && (
          <div className="tw-zoom-buttons" aria-hidden="false">
            <button type="button" className="tw-zoom-btn" onClick={zoomIn}>+</button>
            <button type="button" className="tw-zoom-btn" onClick={zoomOut}>−</button>
          </div>
        )}
      </div>

      <div className="selected-date">{formatDateRangeDisplay()}</div>
      <div className="zoom-indicator">
        {isDayViewMode ? " Day view " : isYearMode ? " Year view " : " Month view "}  
        ( scroll to zoom {zoomLevel < 0.5 ? "time window, drag to shift" : "time window, drag to shift "} )
      </div>
    </div>
  );
};

export default TimeWindowSlider;