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
                                opacity: 0.5
                            }"
                        >
                            {{ getStateLabel(stateValue) }}
                        </span>
                    </span>
                </div>
            </div>
            <div
                v-if="stateData.length > 0" ref="timelineBar" class="timeline-bar"
                :style="{ height: barHeight + 'px' }"
            >
                <v-menu
                    v-for="(segment, index) in stateData"
                    :key="index"
                    open-on-hover
                    open-on-click
                    :close-delay="100"
                    :open-delay="200"
                    location="bottom"
                    transition="scale-transition"
                    offset="10"
                >
                    <template #activator="{ props }">
                        <div
                            v-bind="props"
                            class="timeline-segment"
                            :style="{ width: getWidth(segment) + '%', backgroundColor: getColor(segment.state) }"
                        />
                    </template>
                    <v-card class="pa-0 details-card" width="fit-content" style="display: inline-block; background: rgb(var(--v-theme-surface)) !important;">
                        <v-card-title class="text-caption pa-1">
                            {{ getStateLabel(segment.state) }}
                        </v-card-title>
                        <v-card-text class="pa-0">
                            <v-list density="compact" color="">
                                <v-list-item>
                                    <v-list-item-title class="text-caption">Start:</v-list-item-title>
                                    <v-list-item-subtitle class="text-body-2">
                                        {{ formatTime(new Date(segment.start), detailsTimeFormat) }}
                                    </v-list-item-subtitle>
                                </v-list-item>
                                <v-list-item>
                                    <v-list-item-title class="text-caption">End:</v-list-item-title>
                                    <v-list-item-subtitle class="text-body-2">
                                        {{ formatTime(new Date(segment.end), detailsTimeFormat) }}
                                    </v-list-item-subtitle>
                                </v-list-item>
                                <v-list-item>
                                    <v-list-item-title class="text-caption">Duration:</v-list-item-title>
                                    <v-list-item-subtitle class="text-body-2">
                                        {{ getFormattedDuration(segment) }}
                                    </v-list-item-subtitle>
                                </v-list-item>
                            </v-list>
                        </v-card-text>
                    </v-card>
                </v-menu>
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
                        opacity: 0.5
                    }"
                >
                    {{ marker.label }}
                </span>
            </div>
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
        // No additional data needed
        }
    },
    computed: {
        ...mapState('data', ['messages']),
        stateData () {
            return this.messages[this.id]?.payload?.stateData || []
        },
        title () {
            return this.getProperty('title') || 'State Timeline'
        },
        barHeight () {
            return this.getProperty('barHeight') || 30
        },
        // Timeline time format (for axis/markers)
        timelineTimeFormat () {
            // Configurable via props.timelineTimeFormat, fallback to default
            return this.getProperty('timelineTimeFormat') || 'h:mm A'
        },
        // Details card time format (for popover/details)
        detailsTimeFormat () {
            // Configurable via props.detailsTimeFormat, fallback to default
            return this.getProperty('detailsTimeFormat') || 'M/DD/YY h:mm A'
        },
        minTimeLabelGap () {
            return this.getProperty('minTimeLabelGap') || 6
        },
        showTimeMarkers () {
            return this.getProperty('showTimeMarkers') !== undefined
                ? !!this.getProperty('showTimeMarkers')
                : true
        },
        showOnlyStartEndTimes () {
            return this.showTimeMarkers && !!this.getProperty('showOnlyStartEndTimes')
        },
        stateDefinitions () {
            const statesArray = this.getProperty('states')
            if (Array.isArray(statesArray) && statesArray.length >= 2) {
                return statesArray
            } else {
                console.warn(`State definitions (props.states) for ${this.id} are missing or invalid. Using defaults.`)
                return [
                    { label: 'On', value: 'on', valueType: 'str', color: '#009933' },
                    { label: 'Off', value: 'off', valueType: 'str', color: '#999999' }
                ]
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
            return this.stateData.length > 0 && this.totalEndMs === this.totalStartMs ? 1 : 0
        },
        timeMarkers () {
            if (!this.stateData.length || this.totalDurationMs <= 0) {
                return []
            }
            const markers = []
            const totalStart = this.totalStartMs
            const totalDuration = this.totalDurationMs
            markers.push({
                label: this.formatTime(new Date(totalStart), this.timelineTimeFormat),
                position: 0,
                time: totalStart
            })
            this.stateData.forEach((segment, index) => {
                const segmentEndMs = new Date(segment.end).getTime()
                if (!markers.some(m => m.time === segmentEndMs)) {
                    const position = Math.min(100, Math.max(0, ((segmentEndMs - totalStart) / totalDuration) * 100))
                    markers.push({
                        label: this.formatTime(new Date(segment.end), this.timelineTimeFormat),
                        position,
                        time: segmentEndMs
                    })
                }
            })
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
                    if (!lastAddedMarker) return
                    const gap = marker.position - lastAddedMarker.position
                    if (isLast) {
                        if (gap < minGapPercentage && filteredMarkers.length > 1 && lastAddedMarker !== filteredMarkers[0]) {
                            filteredMarkers.pop()
                        }
                        filteredMarkers.push(marker)
                        lastAddedMarker = marker
                    } else if (gap >= minGapPercentage) {
                        filteredMarkers.push(marker)
                        lastAddedMarker = marker
                    }
                }
            })
            return filteredMarkers
        },
        filteredTimeMarkers () {
            if (!this.showTimeMarkers) {
                return []
            }
            if (this.showOnlyStartEndTimes) {
                if (this.timeMarkers.length === 0) return []
                if (this.timeMarkers.length === 1) return [this.timeMarkers[0]]
                return [this.timeMarkers[0], this.timeMarkers[this.timeMarkers.length - 1]]
            }
            return this.timeMarkers
        },
        uniqueStates () {
            return [...new Set(this.stateData.map(segment => segment.state))]
        }
    },
    created () {
        this.$dataTracker(this.id, this.onInput, null, this.onDynamicProperty, null)
        this.$socket.emit('widget-load', this.id)
    },
    methods: {
        onInput (msg) {
            const updates = msg.ui_update
            if (updates) {
                this.updateDynamicProperty('label', updates.label)
                this.updateDynamicProperty('options', updates.options)
                this.updateDynamicProperty('showTimeMarkers', updates.showTimeMarkers)
                this.updateDynamicProperty('showOnlyStartEndTimes', updates.showOnlyStartEndTimes)
                this.updateDynamicProperty('timelineTimeFormat', updates.timelineTimeFormat)
                this.updateDynamicProperty('detailsTimeFormat', updates.detailsTimeFormat)
            }
        },
        onDynamicProperty (msg) {
            const updates = msg.ui_update
            if (updates) {
                this.updateDynamicProperty('label', updates.label)
                this.updateDynamicProperty('options', updates.options)
                this.updateDynamicProperty('showTimeMarkers', updates.showTimeMarkers)
                this.updateDynamicProperty('showOnlyStartEndTimes', updates.showOnlyStartEndTimes)
                this.updateDynamicProperty('timelineTimeFormat', updates.timelineTimeFormat)
                this.updateDynamicProperty('detailsTimeFormat', updates.detailsTimeFormat)
            }
        },
        getWidth (segment) {
            const start = new Date(segment.start).getTime()
            const end = new Date(segment.end).getTime()
            if (end <= start || !this.totalDurationMs || this.totalDurationMs <= 0) {
                return 0
            }
            const duration = end - start
            return (duration / this.totalDurationMs) * 100
        },
        getColor (stateValue) {
            const definition = this.stateDefinitions.find(def => def.value === stateValue)
            return definition ? definition.color : 'grey'
        },
        getStateLabel (stateValue) {
            const definition = this.stateDefinitions.find(def => def.value === stateValue)
            return definition ? definition.label : stateValue
        },
        /**
         * Format a Date/time value using the provided format string.
         * @param {Date|string|number} input - The date/time to format.
         * @param {string} formatOverride - The format string to use.
         * @returns {string}
         */
        formatTime (input, formatOverride) {
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
            const format = formatOverride || this.timelineTimeFormat || 'HH:mm'
            const hours24 = time.getHours()
            const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
            const minutes = time.getMinutes()
            const ampm = hours24 < 12 ? 'am' : 'pm'
            const AMPM = ampm.toUpperCase()
            const year = time.getFullYear()
            const yearShort = String(year).slice(-2)
            const month = time.getMonth() + 1
            const day = time.getDate()
            const formatted = format
                .replace(/YYYY/g, String(year))
                .replace(/YY/g, yearShort)
                .replace(/MM/g, String(month).padStart(2, '0'))
                .replace(/M/g, String(month))
                .replace(/DD/g, String(day).padStart(2, '0'))
                .replace(/D/g, String(day))
                .replace(/hh/g, String(hours12).padStart(2, '0'))
                .replace(/h/g, String(hours12))
                .replace(/HH/g, String(hours24).padStart(2, '0'))
                .replace(/H/g, String(hours24))
                .replace(/mm/g, String(minutes).padStart(2, '0'))
                .replace(/m/g, String(minutes))
                .replace(/a/g, ampm)
                .replace(/A/g, AMPM)
            return formatted
        },
        getFormattedDuration (segment) {
            const start = new Date(segment.start)
            const end = new Date(segment.end)
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
        }
    }
}
</script>

  <style scoped>
  @import "../stylesheets/ui-state-timeline.css";
  </style>
