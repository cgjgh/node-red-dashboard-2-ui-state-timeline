<template>
    <v-container>
        <div ref="timelineContainer" class="history-timeline">
            <div class="ui-state-timeline">
                <label v-if="props.label" ref="title" class="nrdb-ui-state-timeline-title">{{ props.label }}</label>
                <v-spacer />
                <div class="legend">
                    <span v-for="stateValue in uniqueStates" :key="stateValue" class="legend-item">
                        <span class="color-box" :style="{ backgroundColor: getColor(stateValue) }" />
                        <span
                            :style="{
                                color: `var(--v-theme-on-group-background)`,
                                opacity: 0.5 // or any value less than 1 for more gray
                            }"
                        >
                            {{ getStateLabel(stateValue) }}
                        </span>
                    </span>
                </div>
            </div>
            <div
                v-if="stateData.length > 0" ref="timelineBar" class="timeline-bar"
                :style="{ height: barHeight + 'px' }" @click="onTimelineClick"
            >
                <div
                    v-for="(segment, index) in stateData" :key="index" class="timeline-segment"
                    :class="{ 'selected': segment === selectedSegment }"
                    :style="{ width: getWidth(segment) + '%', backgroundColor: getColor(segment.state) }"
                    @click.stop="onSegmentClick(segment, $event)" @mouseenter="onSegmentMouseEnter(segment, $event)"
                    @mouseleave="onSegmentMouseLeave"
                />
            </div>
            <div v-else class="no-data">No history data available</div>

            <div v-if="stateData.length > 0 && showTimeMarkers" class="time-axis">
                <span
                    v-for="(marker, index) in filteredTimeMarkers"
                    :key="index"
                    class="time-marker"
                    :style="{
                        left: marker.position + '%',
                        color: `var(--v-theme-on-group-background)`,
                        borderColor: `var(--v-theme-on-group-background)`,
                        opacity: 0.5 // or any value less than 1 for more gray
                    }"
                >
                    {{ marker.label }}
                </span>
            </div>

            <v-card v-if="displaySegment" ref="detailsCard" class="pa-2 details-card" :style="cardStyle">
                <v-card-title class="text-caption pa-1">
                    {{ getStateLabel(displaySegment.state) }}
                </v-card-title>
                <v-card-text class="pa-1">
                    <v-list dense>
                        <v-list-item>
                            <v-list-item-title class="text-caption">Start:</v-list-item-title>
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
                            <v-list-item-title class="text-caption">Duration:</v-list-item-title>
                            <v-list-item-subtitle class="text-body-2">
                                {{ formattedDuration }}
                            </v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </v-card-text>
            </v-card>
        </div>
    </v-container>
</template>

<script>
import { mapState } from 'vuex'

export default {
    name: 'DBStateTimeline',
    inject: ['$socket', '$dataTracker'],
    props: {
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) },
        state: { type: Object, default: () => ({}) }
    },
    data () {
        return {
            selectedSegment: null,
            hoveredSegment: null,
            cardTop: 0,
            cardLeft: 0,
            cardVisible: false
        }
    },
    computed: {
        ...mapState('data', ['messages']),
        // Standard properties remain the same
        stateData () {
            return this.messages[this.id]?.payload?.stateData || []
        },
        title () {
            return this.getProperty('title') || 'State Timeline'
        },
        barHeight () {
            return this.getProperty('barHeight') || 30
        },
        timeFormat () {
            return this.getProperty('timeFormat') || 'hh:mm a'
        },
        minTimeLabelGap () {
            return this.getProperty('minTimeLabelGap') || 6
        },
        // Configuration options for time markers
        showTimeMarkers () {
            // Default to true if not set
            return this.getProperty('showTimeMarkers') !== undefined
                ? !!this.getProperty('showTimeMarkers')
                : true
        },
        showOnlyStartEndTimes () {
            // Only true if showTimeMarkers is true and this prop is true
            return this.showTimeMarkers && !!this.getProperty('showOnlyStartEndTimes')
        },
        // Replaced parsedColorMap with stateDefinitions
        stateDefinitions () {
            // Get the 'states' property directly from props
            const statesArray = this.getProperty('states')
            // Check if it's a valid array (as configured in Node-RED)
            if (Array.isArray(statesArray) && statesArray.length >= 2) { // Ensure at least 2 states as per editor validation
                return statesArray
            } else {
                // Fallback or error handling if states are not configured correctly
                console.warn(`State definitions (props.states) for ${this.id} are missing or invalid (requires array with >= 2 items). Using defaults. Received:`, statesArray)
                // Provide a minimal default matching the old behavior + editor defaults
                return [
                    { label: 'On', value: 'on', valueType: 'str', color: '#009933' },
                    { label: 'Off', value: 'off', valueType: 'str', color: '#999999' }
                    // { label: 'Error', value: 'error', valueType: 'str', color: 'orange' } // Example third state
                ]
            }
        },
        // Other computed properties remain the same
        displaySegment () {
            return this.selectedSegment || this.hoveredSegment
        },
        formattedDuration () {
            if (!this.displaySegment) return ''

            const start = new Date(this.displaySegment.start)
            const end = new Date(this.displaySegment.end)
            const totalMinutes = Math.round((end - start) / 1000 / 60)

            if (totalMinutes > 59) {
                const hours = Math.floor(totalMinutes / 60)
                const minutes = totalMinutes % 60
                let result = `${hours} hour${hours > 1 ? 's' : ''}`
                if (minutes > 0) {
                    result += ` ${minutes} minute${minutes > 1 ? 's' : ''}`
                }
                return result
            } else {
                return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`
            }
        },
        cardStyle () {
            return {
                position: 'absolute',
                top: `${this.cardTop}px`,
                left: `${this.cardLeft}px`,
                zIndex: 24,
                width: '200px'
            }
        },
        totalStartMs () {
            return this.stateData.length > 0 ? new Date(this.stateData[0].start).getTime() : null
        },
        totalEndMs () {
            return this.stateData.length > 0 ? new Date(this.stateData[this.stateData.length - 1].end).getTime() : null
        },
        totalDurationMs () {
            if (this.totalEndMs && this.totalStartMs && this.totalEndMs > this.totalStartMs) {
                return this.totalEndMs - this.totalStartMs
            }
            // Handle case where start and end are the same (single point in time) -> treat duration as minimal positive value to avoid division by zero
            return this.stateData.length > 0 && this.totalEndMs === this.totalStartMs ? 1 : 0
        },
        timeMarkers () {
            if (!this.stateData.length || this.totalDurationMs <= 0) {
                return []
            }
            const markers = []
            const totalStart = this.totalStartMs
            const totalDuration = this.totalDurationMs

            // Add marker for the very start
            markers.push({
                label: this.formatTime(new Date(totalStart)),
                position: 0,
                time: totalStart
            })

            // Add markers for segment end times (which are start times of the next, except the last one)
            this.stateData.forEach((segment, index) => {
                const segmentEndMs = new Date(segment.end).getTime()
                // Ensure we don't add duplicate time markers if segments are back-to-back with same end/start time
                if (!markers.some(m => m.time === segmentEndMs)) {
                    const position = Math.min(100, Math.max(0, ((segmentEndMs - totalStart) / totalDuration) * 100))
                    markers.push({
                        label: this.formatTime(new Date(segment.end)),
                        position,
                        time: segmentEndMs
                    })
                }
            })

            // Filter markers based on minimum gap
            if (markers.length <= 1) {
                return markers // No filtering needed for 0 or 1 markers
            }

            // Sort markers by position first, then time to be safe
            markers.sort((a, b) => a.position - b.position || a.time - b.time)

            const filteredMarkers = []
            const minGapPercentage = Number(this.minTimeLabelGap) >= 0 ? Number(this.minTimeLabelGap) : 6
            let lastAddedMarker = null

            markers.forEach((marker, index) => {
                const isFirst = index === 0
                const isLast = index === markers.length - 1

                if (isFirst) {
                    filteredMarkers.push(marker)
                    lastAddedMarker = marker
                } else {
                    // Ensure lastAddedMarker is not null (shouldn't happen after isFirst)
                    if (!lastAddedMarker) return

                    const gap = marker.position - lastAddedMarker.position

                    // Always add the last marker regardless of gap, potentially replacing the previous one if too close
                    if (isLast) {
                        // If the last marker is too close to the previously added one (which wasn't the first one)
                        if (gap < minGapPercentage && filteredMarkers.length > 1 && lastAddedMarker !== filteredMarkers[0]) {
                            filteredMarkers.pop() // Remove the previously added one
                        }
                        filteredMarkers.push(marker) // Add the actual last marker
                        lastAddedMarker = marker
                    } else if (gap >= minGapPercentage) {
                        // Add intermediate markers only if gap is sufficient
                        filteredMarkers.push(marker)
                        lastAddedMarker = marker
                    }
                }
            })
            return filteredMarkers
        },
        // Filtered markers based on configuration
        filteredTimeMarkers () {
            if (!this.showTimeMarkers) {
                return []
            }
            if (this.showOnlyStartEndTimes) {
                // Only show first and last marker (start and end)
                if (this.timeMarkers.length === 0) return []
                if (this.timeMarkers.length === 1) return [this.timeMarkers[0]]
                return [
                    this.timeMarkers[0],
                    this.timeMarkers[this.timeMarkers.length - 1]
                ]
            }
            // Otherwise, show all computed markers
            return this.timeMarkers
        },
        uniqueStates () {
            // Returns unique state *values* present in the data
            return [...new Set(this.stateData.map(segment => segment.state))]
        }
    },
    created () {
        // Setup remains the same
        this.$dataTracker(this.id, this.onInput, null, this.onDynamicProperty, null)
        this.$socket.emit('widget-load', this.id)
    },
    mounted () {
        document.addEventListener('mousedown', this.handleClickOutside)
    },
    beforeUnmount () {
        document.removeEventListener('mousedown', this.handleClickOutside)
    },
    methods: {
        onInput (msg) {
            // Handle dynamic property updates via msg.ui_update
            const updates = msg.ui_update
            if (updates) {
                // These keys might need adjustment depending on actual dynamic properties sent
                this.updateDynamicProperty('label', updates.label) // Example
                this.updateDynamicProperty('options', updates.options) // Example
                this.updateDynamicProperty('showTimeMarkers', updates.showTimeMarkers)
                this.updateDynamicProperty('showOnlyStartEndTimes', updates.showOnlyStartEndTimes)
                // this.updateDynamicProperty('states', updates.states)
            }
        },
        onDynamicProperty (msg) {
            const updates = msg.ui_update
            if (updates) {
                // These keys might need adjustment depending on actual dynamic properties sent
                this.updateDynamicProperty('label', updates.label) // Example
                this.updateDynamicProperty('options', updates.options) // Example
                this.updateDynamicProperty('showTimeMarkers', updates.showTimeMarkers)
                this.updateDynamicProperty('showOnlyStartEndTimes', updates.showOnlyStartEndTimes)
                // this.updateDynamicProperty('states', updates.states)
            }
        },
        // getWidth remains the same
        getWidth (segment) {
            const start = new Date(segment.start).getTime()
            const end = new Date(segment.end).getTime()
            if (end <= start || !this.totalDurationMs || this.totalDurationMs <= 0) {
                // Return minimal width for zero/negative duration segments to make them visible if needed, or 0
                return 0
            }
            const duration = end - start
            return (duration / this.totalDurationMs) * 100
        },
        // getColor method updated to use stateDefinitions array
        getColor (stateValue) {
            const definition = this.stateDefinitions.find(def => def.value === stateValue)
            return definition ? definition.color : 'grey' // Fallback color
        },
        // New method to get the label for a state value
        getStateLabel (stateValue) {
            const definition = this.stateDefinitions.find(def => def.value === stateValue)
            // Fallback to the value itself if no label is found (robustness)
            return definition ? definition.label : stateValue
        },
        // UI interaction methods remain largely the same
        calculateCardPosition (segmentElement) {
            if (!this.$refs.timelineBar || !segmentElement || !this.$refs.timelineContainer) {
                console.warn('Timeline refs not ready for card positioning.')
                return
            }
            const timelineBarRect = this.$refs.timelineBar.getBoundingClientRect()
            const segmentRect = segmentElement.getBoundingClientRect()
            const containerRect = this.$refs.timelineContainer.getBoundingClientRect()

            // Position card below the timeline bar
            this.cardTop = timelineBarRect.bottom - containerRect.top + 5 // Add some spacing

            // Center card horizontally relative to the segment, adjusted for container bounds
            const segmentCenter = segmentRect.left + segmentRect.width / 2
            const cardWidth = 200 // As defined in cardStyle
            let potentialLeft = segmentCenter - containerRect.left - cardWidth / 2

            // Adjust left position to stay within container bounds
            const containerWidth = this.$refs.timelineContainer.offsetWidth
            const padding = 5 // Minimal padding from edges

            if (potentialLeft + cardWidth > containerWidth - padding) {
                // Too far right, align right edge with container edge (minus padding)
                potentialLeft = containerWidth - cardWidth - padding
            }
            if (potentialLeft < padding) {
                // Too far left, align left edge with container edge (plus padding)
                potentialLeft = padding
            }

            this.cardLeft = potentialLeft
        },
        onSegmentMouseEnter (segment, event) {
            if (!this.selectedSegment) {
                this.hoveredSegment = segment
                this.$nextTick(() => {
                    if (this.$refs.detailsCard) {
                        this.calculateCardPosition(event.target)
                    }
                })
            }
        },
        onSegmentMouseLeave () {
            // Only clear hover if it's not the selected segment
            if (!this.selectedSegment || this.hoveredSegment !== this.selectedSegment) {
                this.hoveredSegment = null
            }
        },
        onSegmentClick (segment, event) {
            if (this.selectedSegment === segment) {
                // Clicked already selected segment: deselect
                this.selectedSegment = null
                this.hoveredSegment = null // Clear hover as well
            } else {
                // Clicked a new segment: select it
                this.selectedSegment = segment
                this.hoveredSegment = segment // Ensure hover state matches selection
                this.$nextTick(() => {
                    if (this.$refs.detailsCard) {
                        this.calculateCardPosition(event.target)
                    }
                })
            }
        },
        onTimelineClick (event) {
            // If click is directly on the bar background (not a segment), deselect
            if (event.target === this.$refs.timelineBar) {
                this.selectedSegment = null
                this.hoveredSegment = null
            }
        },
        handleClickOutside (event) {
            if (!this.$refs.detailsCard) return
            const card = this.$refs.detailsCard.$el || this.$refs.detailsCard
            if (this.displaySegment && card && !card.contains(event.target) &&
                !event.target.classList.contains('timeline-segment')) {
                this.selectedSegment = null
                this.hoveredSegment = null
            }
        },

        /**
         * Formats a date/time input using a minimal set of tokens:
         * hh, h, HH, H, mm, m, a, A, YYYY, YY, MM, M, DD, D
         * Accepts Date, string, or timestamp.
         * Example: 'YYYY-MM-DD HH:mm', 'hh:mm a', 'M/D/YY h:m A'
         */
        formatTime (input) {
            let time
            if (input instanceof Date) {
                time = input
            } else if (typeof input === 'string' || typeof input === 'number') {
                time = new Date(input)
            } else {
                console.warn('Unsupported input type for formatTime:', input)
                return 'Invalid Time'
            }
            if (!(time instanceof Date) || isNaN(time)) {
                console.warn('Invalid date passed to formatTime:', input)
                return 'Invalid Time'
            }

            const format = this.timeFormat || 'HH:mm'

            // Extract date and time parts
            const hours24 = time.getHours()
            const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
            const minutes = time.getMinutes()
            const ampm = hours24 < 12 ? 'am' : 'pm'
            const AMPM = ampm.toUpperCase()
            const year = time.getFullYear()
            const yearShort = String(year).slice(-2)
            const month = time.getMonth() + 1
            const day = time.getDate()

            // Replace tokens in format string
            // eslint-disable-next-line prefer-const
            let formatted = format
                // Date tokens
                .replace(/YYYY/g, String(year))
                .replace(/YY/g, yearShort)
                .replace(/MM/g, String(month).padStart(2, '0'))
                .replace(/M/g, String(month))
                .replace(/DD/g, String(day).padStart(2, '0'))
                .replace(/D/g, String(day))
                // Time tokens
                .replace(/hh/g, String(hours12).padStart(2, '0'))
                .replace(/h/g, String(hours12))
                .replace(/HH/g, String(hours24).padStart(2, '0'))
                .replace(/H/g, String(hours24))
                .replace(/mm/g, String(minutes).padStart(2, '0'))
                .replace(/m/g, String(minutes))
                .replace(/a/g, ampm)
                .replace(/A/g, AMPM)

            return formatted
        }
    }
}

</script>

<style scoped>
@import "../stylesheets/ui-state-timeline.css";
</style>
