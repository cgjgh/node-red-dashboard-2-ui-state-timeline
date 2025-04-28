<template>
    <v-app>
        <v-container>
            <div ref="timelineContainer" class="history-timeline">
                <h3>{{ props.title || 'History Timeline' }}</h3>

                <div
                    v-if="historyData.length > 0"
                    ref="timelineBar"
                    class="timeline-bar"
                    :style="{ height: props.barHeight + 'px' }"
                    @click="onTimelineClick"
                >
                    <div
                        v-for="(segment, index) in historyData"
                        :key="index"
                        class="timeline-segment"
                        :class="{ 'selected': segment === selectedSegment }"
                        :style="{ width: getWidth(segment) + '%', backgroundColor: getColor(segment.state) }"
                        @click.stop="onSegmentClick(segment, $event)"
                        @mouseenter="onSegmentMouseEnter(segment, $event)"
                        @mouseleave="onSegmentMouseLeave"
                    />
                </div>
                <div v-else class="no-data">No history data available</div>

                <div v-if="historyData.length > 0" class="time-axis">
                    <span
                        v-for="(marker, index) in timeMarkers"
                        :key="index"
                        class="time-marker"
                        :style="{ left: marker.position + '%' }"
                    >
                        {{ marker.label }}
                    </span>
                </div>

                <div class="legend">
                    <span v-for="state in uniqueStates" :key="state" class="legend-item">
                        <span
                            class="color-box"
                            :style="{ backgroundColor: getColor(state) }"
                        />
                        {{ state }}
                    </span>
                </div>

                <v-card
                    v-if="displaySegment"
                    ref="detailsCard"
                    class="pa-2 details-card"
                    :style="cardStyle"
                    elevation="4"
                >
                    <v-card-title class="text-caption pa-1">
                        {{ displaySegment.state }}
                    </v-card-title>
                    <v-card-text class="pa-1">
                        <v-list dense>
                            <v-list-item>
                                <v-list-item-title class="text-caption">
                                    Start:
                                </v-list-item-title>
                                <v-list-item-subtitle class="text-body-2">
                                    {{ formatTime(new Date(displaySegment.start)) }}
                                </v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title class="text-caption">End:</v-list-item-title>
                                <v-list-item-subtitle class="text-body-2">
                                    {{ formatTime(new Date(displaySegment.end)) }}
                                </v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title class="text-caption">
                                    Duration:
                                </v-list-item-title>
                                <v-list-item-subtitle class="text-body-2">
                                    {{ Math.round((new Date(displaySegment.end) - new
                                        Date(displaySegment.start)) / 1000 / 60) }} minutes
                                </v-list-item-subtitle>
                            </v-list-item>
                        </v-list>
                    </v-card-text>
                </v-card>
            </div>
        </v-container>
    </v-app>
</template>

<script>

export default {
    name: 'StateTimeline',
    props: {
        // Unique ID for the component instance (optional)
        id: {
            type: String,
            default: 'timeline'
        },
        // Configuration properties passed as an object
        props: {
            type: Object,
            default: () => ({
                title: 'State Timeline', // Title displayed above the timeline
                barHeight: 30, // Height of the timeline bar in pixels
                colorMap: '{"on": "green", "off": "red", "error": "orange"}', // JSON string mapping states to colors
                timeFormat: 'hh:mm a', // Format for displaying time (e.g., 'hh:mm a', 'HH:mm')
                minTimeLabelGap: 6 // Minimum percentage gap required between time labels to prevent overlap
            })
        },
        // Input data for the timeline segments
        // Expected format: [{ start: ISODateString, end: ISODateString, state: String }, ...]
        // Example: history: [ { start: '2023-10-27T10:00:00Z', end: '2023-10-27T10:15:00Z', state: 'on' } ]
        history: {
            type: Array,
            default: () => [] // Default to an empty array if no history is provided
        }
    },
    data () {
        return {
            // Internal state to store processed history data
            historyData: [],
            // Parsed color map from props
            colorMap: {},
            // Currently selected segment (persists on click)
            selectedSegment: null,
            // Segment currently being hovered over (transient)
            hoveredSegment: null,
            // Positioning for the details card
            cardTop: 0,
            cardLeft: 0,
            // Flag for card visibility (though v-if handles rendering)
            cardVisible: false
        }
    },
    computed: {
        // Determines which segment's details to show (selected takes precedence over hover)
        displaySegment () {
            return this.selectedSegment || this.hoveredSegment
        },
        // Dynamically calculates the style for the details card based on position data
        cardStyle () {
            const left = this.cardLeft
            const top = this.cardTop
            return {
                position: 'absolute',
                top: `${top}px`,
                left: `${left}px`,
                zIndex: 10, // Ensure card appears above other elements
                width: '200px' // Fixed width for the card
            }
        },
        // --- Time Calculation Properties ---
        // Calculates the earliest start time from all segments
        totalStartMs () {
            return this.historyData.length > 0
                ? new Date(this.historyData[0].start).getTime()
                : null
        },
        // Calculates the latest end time from all segments
        totalEndMs () {
            return this.historyData.length > 0
                ? new Date(
                    this.historyData[this.historyData.length - 1].end
                ).getTime()
                : null
        },
        // Calculates the total duration covered by the timeline
        totalDurationMs () {
            if (
                this.totalEndMs &&
            this.totalStartMs &&
            this.totalEndMs > this.totalStartMs
            ) {
                return this.totalEndMs - this.totalStartMs
            }
            // Handle cases with invalid data or zero duration to prevent division by zero
            // Return 1ms if times are identical but exist, 0 otherwise
            return this.historyData.length > 0 &&
            this.totalEndMs === this.totalStartMs
                ? 1
                : 0
        },

        // --- Computed Property for Time Markers with Overlap Prevention ---
        timeMarkers () {
            // Return empty if no data or zero duration
            if (!this.historyData.length || this.totalDurationMs <= 0) {
                return []
            }

            const markers = []
            const totalStart = this.totalStartMs
            const totalDuration = this.totalDurationMs // Already handles zero duration case

            // Generate markers for the start of each segment
            this.historyData.forEach(segment => {
                const segmentStartMs = new Date(segment.start).getTime()
                // Calculate position, ensuring it's clamped between 0 and 100
                const position = Math.min(
                    100,
                    Math.max(0, ((segmentStartMs - totalStart) / totalDuration) * 100)
                )
                markers.push({
                    label: this.formatTime(new Date(segment.start)),
                    position,
                    time: segmentStartMs // Store original time for sorting/comparison
                })
            })

            // Generate marker for the end of the *last* segment
            const lastSegment = this.historyData[this.historyData.length - 1]
            const lastEndMs = new Date(lastSegment.end).getTime()
            const endPosition = Math.min(
                100,
                Math.max(0, ((lastEndMs - totalStart) / totalDuration) * 100)
            )

            // Add last marker only if its time is different from the last start time to avoid duplicates at the same point
            if (
                markers.length === 0 ||
            lastEndMs !== markers[markers.length - 1].time
            ) {
                markers.push({
                    label: this.formatTime(new Date(lastSegment.end)),
                    position: endPosition,
                    time: lastEndMs
                })
            }

            // --- Overlap Prevention Logic ---
            if (markers.length <= 1) {
            // No overlap possible with 0 or 1 marker
                return markers
            }

            // Sort markers by position primarily, then by time as a fallback (for identical positions)
            markers.sort((a, b) => {
                if (a.position !== b.position) {
                    return a.position - b.position
                }
                return a.time - b.time // Secondary sort by time if positions are equal
            })

            const filteredMarkers = []
            // Use prop for minimum gap, default to 6% if not provided/invalid
            const minGapPercentage =
            Number(this.props.minTimeLabelGap) >= 0
                ? Number(this.props.minTimeLabelGap)
                : 6
            let lastAddedMarker = null

            markers.forEach((marker, index) => {
                const isFirst = index === 0
                const isLast = index === markers.length - 1

                if (isFirst) {
                    // Always add the first marker
                    filteredMarkers.push(marker)
                    lastAddedMarker = marker
                } else {
                    // Calculate position difference from the last *added* marker
                    const gap = marker.position - lastAddedMarker.position

                    if (gap >= minGapPercentage) {
                        // Enough space, add the current marker
                        filteredMarkers.push(marker)
                        lastAddedMarker = marker
                    } else if (isLast && gap < minGapPercentage) {
                        // Current marker is the *last* one, and it *overlaps* the last added one.
                        // Replace the last added marker *only if* the last added wasn't the *very first* marker overall.
                        // This prioritizes showing the final end time.
                        if (filteredMarkers.length > 1) {
                            const lastAddedIndex = filteredMarkers.findIndex(
                                m => m === lastAddedMarker
                            )
                            // Ensure we don't remove the very first marker (index 0)
                            if (lastAddedIndex > 0) {
                                filteredMarkers.splice(lastAddedIndex, 1) // Remove the previously added marker
                                filteredMarkers.push(marker) // Add the actual last marker instead
                                lastAddedMarker = marker // Update last added marker reference
                            }
                            // If the last marker overlaps with the first marker (and filteredMarkers.length is 1),
                            // we keep the first marker and do not add the last one (implicit).
                        }
                        // If filteredMarkers.length is 1, it means the last marker overlaps the very first one.
                        // In this case, we keep the first and don't add the last. This prevents the end label overwriting the start label when the total duration is very short.
                    }
                    // else: It's an intermediate marker that overlaps, so we skip it (do nothing).
                }
            })

            return filteredMarkers // Return the filtered list of markers
        },
        // Extracts unique state names for the legend
        uniqueStates () {
            // Use a Set to efficiently get unique state values
            return [...new Set(this.historyData.map(segment => segment.state))]
        }
    },
    watch: {
        // Watch the input 'history' prop for changes
        history: {
            handler (newHistory) {
                this.processHistoryData(newHistory)
            },
            immediate: true, // Run the handler immediately when the component is created
            deep: true // Watch for changes inside the array objects
        },
        // Watch the 'props.colorMap' prop for changes
        'props.colorMap': {
            handler (newColorMap) {
                this.parseColorMap(newColorMap)
            },
            immediate: true // Run the handler immediately
        }
    },
    created () {
        // Initial processing is handled by the watchers with immediate: true
        // this.parseColorMap(this.props.colorMap); // Called by watcher
        // this.processHistoryData(this.history); // Called by watcher

        // Use dummy data ONLY if no history prop is provided initially
        if (!this.history || this.history.length === 0) {
            console.warn(
                "StateTimeline: No 'history' prop provided. Using dummy data."
            )
            this.initializeDummyData()
        }
    },
    methods: {
        // Parses the colorMap JSON string from props into an object
        parseColorMap (colorMapString) {
            try {
                this.colorMap = JSON.parse(colorMapString || '{}')
            } catch (e) {
                console.error(
                    'StateTimeline: Failed to parse colorMap prop. Using default.',
                    e
                )
                this.colorMap = { on: 'green', off: 'red', error: 'orange' } // Default fallback
            }
        },
        // Processes the history data prop: sorts and validates
        processHistoryData (historyArray) {
            if (!Array.isArray(historyArray)) {
                console.error(
                    "StateTimeline: Invalid 'history' prop. Expected an array."
                )
                this.historyData = []
                return
            }

            // Filter out invalid entries and sort by start time
            this.historyData = historyArray
                .filter(
                    segment => segment && segment.start && segment.end && segment.state
                ) // Basic validation
                .map(segment => ({
                    // Ensure dates are Date objects internally if needed, though not strictly necessary here
                    ...segment
                    // start: new Date(segment.start), // Optional: Convert to Date objects
                    // end: new Date(segment.end)
                }))
                .sort((a, b) => new Date(a.start) - new Date(b.start)) // Sort by start time

            // Optional: Add validation for overlapping segments or gaps if required by application logic
        },
        // Generates dummy data for demonstration purposes if no history is provided
        initializeDummyData () {
            const now = new Date()
            const dummy = [
                {
                    start: new Date(now.getTime() - 60 * 60000).toISOString(),
                    end: new Date(now.getTime() - 58 * 60000).toISOString(),
                    state: 'off'
                }, // 2 min
                {
                    start: new Date(now.getTime() - 58 * 60000).toISOString(),
                    end: new Date(now.getTime() - 50 * 60000).toISOString(),
                    state: 'on'
                }, // 8 min
                {
                    start: new Date(now.getTime() - 50 * 60000).toISOString(),
                    end: new Date(now.getTime() - 49 * 60000).toISOString(),
                    state: 'error'
                }, // 1 min (using 'error' state)
                {
                    start: new Date(now.getTime() - 49 * 60000).toISOString(),
                    end: new Date(now.getTime() - 48 * 60000).toISOString(),
                    state: 'on'
                }, // 1 min
                {
                    start: new Date(now.getTime() - 48 * 60000).toISOString(),
                    end: new Date(now.getTime() - 30 * 60000).toISOString(),
                    state: 'off'
                }, // 18 min
                {
                    start: new Date(now.getTime() - 30 * 60000).toISOString(),
                    end: new Date(now.getTime() - 5 * 60000).toISOString(),
                    state: 'on'
                }, // 25 min
                {
                    start: new Date(now.getTime() - 5 * 60000).toISOString(),
                    end: now.toISOString(),
                    state: 'off'
                } // 5 min
            ]
            this.processHistoryData(dummy) // Process the dummy data
        },
        // Calculates the width percentage for a given segment based on its duration
        getWidth (segment) {
            const start = new Date(segment.start).getTime()
            const end = new Date(segment.end).getTime()
            // Check for invalid segment times or zero total duration
            if (
                end <= start ||
            !this.totalDurationMs ||
            this.totalDurationMs <= 0
            ) {
                return 0
            }
            const duration = end - start
            // Calculate percentage width
            return (duration / this.totalDurationMs) * 100
        },
        // Gets the color for a given state from the colorMap
        getColor (state) {
            return this.colorMap[state] || 'grey' // Use grey as a fallback for unknown states
        },
        // Calculates the position for the details card based on the segment's element
        calculateCardPosition (segmentElement) {
            // Ensure all necessary refs are available
            if (
                !this.$refs.timelineBar ||
            !segmentElement ||
            !this.$refs.timelineContainer
            ) {
                console.warn('Timeline refs not ready for card positioning.')
                return
            }

            const timelineBarRect = this.$refs.timelineBar.getBoundingClientRect()
            const segmentRect = segmentElement.getBoundingClientRect()
            const containerRect =
            this.$refs.timelineContainer.getBoundingClientRect()

            // Position card below the timeline bar with a small gap
            this.cardTop = timelineBarRect.bottom - containerRect.top + 5

            // Initial horizontal position: align card's left edge near the segment's start
            this.cardLeft = segmentRect.left - containerRect.left + 5

            // --- Boundary Checks ---
            const containerWidth = this.$refs.timelineContainer.offsetWidth
            const cardWidth = 200 // Must match cardStyle width or measure dynamically if needed

            // Check right boundary: if card goes off-screen right
            if (this.cardLeft + cardWidth > containerWidth) {
            // Option 1: Align card's right edge with container's right edge
                this.cardLeft = containerWidth - cardWidth - 5
            // Option 2: Align card's right edge with segment's right edge (might look better)
            // this.cardLeft = segmentRect.right - containerRect.left - cardWidth - 5;
            }

            // Check left boundary: if card goes off-screen left
            if (this.cardLeft < 0) {
                this.cardLeft = 5 // Adjust to stay within left bounds
            }
        },
        // Handles mouse entering a segment element
        onSegmentMouseEnter (segment, event) {
            // Only show hover effect if no segment is actively selected
            if (!this.selectedSegment) {
                this.hoveredSegment = segment
                // Use nextTick to ensure the card element (v-if) is rendered before calculating position
                this.$nextTick(() => {
                    // Check if the detailsCard ref exists (it should due to v-if="displaySegment")
                    if (this.$refs.detailsCard) {
                        this.calculateCardPosition(event.target)
                    }
                })
            }
        },
        // Handles mouse leaving a segment element
        onSegmentMouseLeave () {
            // Clear hover state only if the leaving segment wasn't the selected one
            if (this.hoveredSegment !== this.selectedSegment) {
                this.hoveredSegment = null
            }
        },
        // Handles clicking on a segment element
        onSegmentClick (segment, event) {
            if (this.selectedSegment === segment) {
            // Clicked the already selected segment: Deselect it
                this.selectedSegment = null
                this.hoveredSegment = null // Also clear hover state
            } else {
            // Clicked a new segment: Select it
                this.selectedSegment = segment
                this.hoveredSegment = segment // Keep hover active on the selected segment
                // Use nextTick to ensure card is rendered before positioning
                this.$nextTick(() => {
                    if (this.$refs.detailsCard) {
                        this.calculateCardPosition(event.target)
                    }
                })
            // Optional: Emit an event to notify parent component of selection
            // this.$emit('segment-selected', segment);
            }
        },
        // Handles clicking directly on the timeline bar background (not a segment)
        onTimelineClick (event) {
            // If the click target is the timeline bar itself, deselect any selected segment
            if (event.target === this.$refs.timelineBar) {
                this.selectedSegment = null
                this.hoveredSegment = null // Also clear any lingering hover state
            }
        },
        // Formats a Date object into a time string based on props.timeFormat
        formatTime (time) {
            // Validate input
            if (!(time instanceof Date) || isNaN(time)) {
                console.warn(
                    'StateTimeline: Invalid date passed to formatTime:',
                    time
                )
                return 'Invalid Time' // Return explicit error string
            }

            // Define formatting options
            const options = {
            // Default options
                hour: '2-digit',
                minute: '2-digit',
                // Determine hour cycle based on format string presence
                hour12: this.props.timeFormat
                    ? this.props.timeFormat.toLowerCase().includes('h') &&
                !this.props.timeFormat.includes('H')
                    : false
            }

            // Refine based on common patterns in the format string
            const format = this.props.timeFormat || '' // Ensure format is a string
            if (format.includes('a') || format.includes('A')) {
                options.hour12 = true
            } else if (format.includes('H')) {
                options.hour12 = false
            } else if (format.includes('h')) {
            // 'h' or 'hh' implies 12-hour clock
                options.hour12 = true
            }
            // Note: toLocaleTimeString standard options don't directly support 'h' vs 'hh' or 'H' vs 'HH'.
            // It usually defaults to the locale's preference (often padded).

            try {
            // Use 'hourCycle' for better control if supported by the browser/locale
                options.hourCycle = options.hour12 ? 'h12' : 'h23'
                // Use 'lookup' match algorithm for options
                options.localeMatcher = 'lookup'
                // Use default locale (undefined) to let the browser decide based on user settings
                return time.toLocaleTimeString(undefined, options)
            } catch (e) {
                console.error(
                    'StateTimeline: Error formatting time:',
                    time,
                    'with options:',
                    options,
                    e
                )
                // Fallback to a simple HH:MM format if complex formatting fails
                const hours = String(time.getHours()).padStart(2, '0')
                const minutes = String(time.getMinutes()).padStart(2, '0')
                return `${hours}:${minutes}`
            }
        }
    }
}
</script>

  <style scoped>
    /* Scoped styles ensure they only apply to this component */
    .history-timeline {
      /* Add padding, especially at the bottom for the time axis and legend */
      padding: 10px 10px 30px 10px;
      position: relative; /* Needed for absolute positioning of card and time markers */
      min-height: 180px; /* Ensure enough space for timeline, axis, legend, and card */
      box-sizing: border-box;
    }
    .timeline-bar {
      display: flex; /* Arrange segments horizontally */
      flex-direction: row;
      width: 100%; /* Take full container width */
      cursor: default; /* Default cursor for the bar background */
      align-items: center; /* Vertically center segments if bar height > segment height */
      /* overflow: hidden; */ /* Optional: Uncomment if bar itself should clip segment transforms */
      /* border-radius: 6px; */ /* Optional: Uncomment if the bar itself needs rounded corners */
    }
    .timeline-segment {
      height: 100%; /* Segments take full height of the bar */
      cursor: pointer; /* Indicate segments are clickable */
      box-sizing: border-box; /* Include border/padding in width calculation */
      /* Smooth transitions for visual feedback */
      transition: box-shadow 0.2s ease, border 0.2s ease, transform 0.2s ease-in,
        border-radius 0.2s ease-in;
      transform-origin: center center; /* Scale vertically from the center */
      border-radius: 0; /* Segments are square by default */
    }

    /* --- Rounded corners for the very first and very last segments --- */
    .timeline-segment:first-child {
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
    }
    .timeline-segment:last-child {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
    }

    /* --- Styles for hover (when not selected) and selected states --- */
    .timeline-segment:hover:not(.selected), /* Apply hover transform only if not selected */
    .timeline-segment.selected {
      transform: scaleY(1.3); /* Scale segment vertically */
      z-index: 5; /* Bring scaled segment above others */
      /* Add rounded corners when scaled */
      border-radius: 6px;
    }

    .timeline-segment:hover:not(.selected) {
      /* Add shadow only on hover (when not selected) */
      box-shadow: 0px 0px 15px 5px rgba(0, 0, 0, 0.6);
    }

    .timeline-segment.selected {
      border: 2px solid #000; /* Add a distinct border when selected */
      box-shadow: 0px 0px 15px 5px rgba(0, 0, 0, 0.6); /* Keep shadow when selected */
      /* Ensure outer corners remain rounded when selected and scaled */
    }
    /* Explicitly keep outer rounding for selected first/last segments */
    .timeline-segment:first-child.selected {
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
    }
    .timeline-segment:last-child.selected {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
    }

    /* --- Style for the message when no data is available --- */
    .no-data {
      text-align: center;
      color: #888; /* Grey text */
      padding: 20px; /* Add some padding */
      font-style: italic;
    }

    /* --- Time Axis Styles --- */
    .time-axis {
      position: relative; /* Container for absolutely positioned markers */
      width: 100%;
      height: 20px; /* Height allocated for the labels */
      margin-top: 8px; /* Space between timeline bar and time labels */
      overflow: visible; /* Allow labels to be positioned correctly */
      user-select: none; /* Prevent accidental text selection of labels */
    }
    .time-marker {
      position: absolute;
      bottom: 0; /* Align labels to the bottom of the axis */
      transform: translateX(
        -50%
      ); /* Center the label text horizontally on its position */
      font-size: 10px; /* Make labels small */
      color: #555; /* Dark grey color for labels */
      white-space: nowrap; /* Prevent labels from wrapping */
      /* Optional: Add a tick mark above the text */
      &::before {
        content: '';
        position: absolute;
        bottom: calc(100% + 1px); /* Position above the text */
        left: 50%;
        transform: translateX(-50%);
        width: 1px;
        height: 4px; /* Height of the tick */
        background-color: #aaa; /* Tick color */
      }
    }

    /* --- Legend Styles --- */
    .legend {
      margin-top: 15px; /* Space above the legend */
      display: flex;
      justify-content: center; /* Center legend items */
      flex-wrap: wrap; /* Allow legend items to wrap on smaller screens */
      padding: 0 10px; /* Add some horizontal padding */
    }
    .legend-item {
      margin: 0 10px 5px 0; /* Spacing between legend items */
      display: inline-flex; /* Align color box and text */
      align-items: center; /* Vertically center items */
      font-size: 0.8rem; /* Smaller font size for legend */
    }
    .color-box {
      display: inline-block;
      width: 12px;
      height: 12px;
      margin-right: 5px; /* Space between color box and text */
      border-radius: 3px; /* Slightly rounded corners for the color box */
    }

    /* --- Details Card Styles --- */
    .details-card {
      /* Most styles are applied via :style binding for positioning */
      /* Add specific styles here if needed, e.g., max-width, min-width */
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2); /* Add shadow for elevation */
    }
    /* Style Vuetify list items within the card for compactness */
    .details-card .v-list-item {
      min-height: 28px; /* Reduce default height */
      padding-top: 2px;
      padding-bottom: 2px;
    }
    .details-card .v-list-item-title,
    .details-card .v-list-item-subtitle {
      line-height: 1.3; /* Adjust line height for better readability */
    }
    .details-card .v-card-title {
      font-weight: bold; /* Make state name bold */
    }
  </style>
