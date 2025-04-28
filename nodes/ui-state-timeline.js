module.exports = function (RED) {
    /**
     * Helper to map hex color to Node-RED status fill color
     * @param {string} hex - Hex color code (with or without #)
     * @returns {string} - Node-RED status fill color name
     */
    function mapHexToStatusFill (hex) {
        if (!hex) return 'grey'
        // Remove hash if present
        hex = hex.replace('#', '')
        // Convert to RGB
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)
        // Calculate distance to allowed colors
        const colors = {
            red: [255, 0, 0],
            green: [0, 128, 0],
            yellow: [255, 255, 0],
            blue: [0, 0, 255],
            grey: [153, 153, 153]
        }
        let minDist = Infinity
        let nearest = 'grey'
        for (const [name, rgb] of Object.entries(colors)) {
            const dist = Math.sqrt(
                Math.pow(r - rgb[0], 2) +
                Math.pow(g - rgb[1], 2) +
                Math.pow(b - rgb[2], 2)
            )
            if (dist < minDist) {
                minDist = dist
                nearest = name
            }
        }
        return nearest
    }

    /**
     * Helper to filter segments by time window (rangeLimit * rangeLimitUnit seconds)
     * @param {Array} segments - Array of {start, end, state}
     * @param {number} rangeLimit - Number of units (e.g., 24)
     * @param {string|number} rangeLimitUnit - Unit in seconds (e.g., 3600)
     * @returns {Array} - Filtered segments
     */
    function filterSegmentsByRange (segments, rangeLimit, rangeLimitUnit) {
        if (!rangeLimit || !rangeLimitUnit) return segments
        const now = Date.now()
        const windowMs = Number(rangeLimit) * Number(rangeLimitUnit) * 1000
        const windowStart = now - windowMs
        // Only include segments that overlap with the window
        return segments.filter(seg => seg.end >= windowStart)
    }

    function StateTimelineNode (config) {
        RED.nodes.createNode(this, config)
        const node = this

        // Set initial status: grey dot and 'none'
        node.status({
            shape: 'dot',
            fill: 'grey',
            text: 'none'
        })

        const allowedStates = (config.states || []).map(state => state.value)

        // Retrieve the dashboard group
        const group = RED.nodes.getNode(config.group)
        const base = group ? group.getBase() : null

        // Internal state to store segments
        let segments = [] // Array of { start: number, end: number, state: string }
        let currentState = null // Tracks the current pending state (e.g., { time, state })
        let lastTimestamp = null // Tracks the last processed timestamp for validation

        // Try to restore previous state from store
        if (base && base.stores && base.stores.data && typeof base.stores.data.get === 'function') {
            const lastMsg = base.stores.data.get(node.id)
            if (lastMsg && lastMsg.payload && Array.isArray(lastMsg.payload.stateData)) {
                // Restore segments
                segments = lastMsg.payload.stateData.map(seg => ({
                    start: new Date(seg.start).getTime(),
                    end: new Date(seg.end).getTime(),
                    state: seg.state
                }))
                // Restore currentState from last segment if available
                if (segments.length > 0) {
                    const lastSegment = segments[segments.length - 1]
                    currentState = {
                        time: lastSegment.end !== undefined ? lastSegment.end : lastSegment.start,
                        state: lastSegment.state
                    }

                    // Update node status to reflect the restored state
                    const stateConfig = (config.states || []).find(s => s.value === currentState.state)
                    const hexColor = stateConfig && stateConfig.color ? stateConfig.color : '#009933' // fallback to green
                    const stateColor = mapHexToStatusFill(hexColor)
                    const stateText = String(currentState.state)

                    node.status({
                        shape: 'dot',
                        fill: stateColor,
                        text: stateText
                    })
                }
            }
        }

        // Optional configuration to update the end time of the last segment every minute
        const liveUpdate = config.liveUpdate || false

        // Range limit config
        const rangeLimit = Number(config.rangeLimit) || 24
        const rangeLimitUnit = Number(config.rangeLimitUnit) || 3600

        // Set up a minute interval to process the current state
        const intervalId = setInterval(() => {
            // Only update if liveUpdate is enabled and if we have a current state
            if (liveUpdate) {
                if (currentState) {
                    const now = Date.now()
                    if (segments.length > 0 && segments[segments.length - 1].state === currentState.state) {
                    // Update the end time of the last segment if the state is unchanged
                        segments[segments.length - 1].end = now
                    }
                }
                // Filter segments for the configured range and remove old ones from memory
                segments = filterSegmentsByRange(segments, rangeLimit, rangeLimitUnit)
                const msg = { payload: { stateData: segments } }
                base.stores.data.save(base, node, msg)
                base.emit('widget-sync:' + node.id, msg, node, null) // let all other connect clients now about the value change
            }
        }, 5000) // 5000 milliseconds = 5 seconds

        // Clean up interval on node close
        node.on('close', function () {
            clearInterval(intervalId)
        })

        // Process incoming messages
        node.on('input', function (msg) {
            try {
                // Handle dynamic property updates via msg.ui_update
                const updates = msg.ui_update
                if (updates) {
                    if (typeof updates.title !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'title', updates.title)
                    }
                    if (typeof updates.barHeight !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'barHeight', updates.barHeight)
                    }
                    if (typeof updates.colorMap !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'colorMap', updates.colorMap)
                    }
                    if (typeof updates.timeFormat !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'timeFormat', updates.timeFormat)
                    }
                    if (typeof updates.minTimeLabelGap !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'minTimeLabelGap', updates.minTimeLabelGap)
                    }
                    if (typeof updates.updateEndTime !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'updateEndTime', updates.updateEndTime)
                    }
                    if (typeof updates.showTimeMarkers !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'showTimeMarkers', updates.showTimeMarkers)
                    }
                    if (typeof updates.showOnlyStartEndTimes !== 'undefined') {
                        base.stores.state.set(base, node, msg, 'showOnlyStartEndTimes', updates.showOnlyStartEndTimes)
                    }
                }

                // Handle message payload
                const payload = msg.payload
                if (!payload) {
                    node.error('No payload provided in message', msg)
                    return
                }

                if (Array.isArray(payload)) {
                    // Array input: [{"time": number, "state": string}, ...]
                    segments = processArrayInput(payload)
                    // Remove old segments from memory
                    segments = filterSegmentsByRange(segments, rangeLimit, rangeLimitUnit)
                    // Set msg.payload.segments with the current segments
                    msg.payload = {
                        stateData: segments.map(segment => ({
                            start: new Date(segment.start).toISOString(),
                            end: new Date(segment.end).toISOString(),
                            state: segment.state
                        }))
                    }
                } else if (typeof payload === 'object' && payload.time != null && payload.state) {
                    // Single state input: {"time": number, "state": string}
                    processSingleInput(payload)
                    // Remove old segments from memory
                    segments = filterSegmentsByRange(segments, rangeLimit, rangeLimitUnit)
                    // Set msg.payload.segments with the current segments
                    msg.payload = {
                        stateData: segments.map(segment => ({
                            start: new Date(segment.start).toISOString(),
                            end: new Date(segment.end).toISOString(),
                            state: segment.state
                        }))
                    }
                } else {
                    node.error('Invalid payload format. Expected object or array.', msg)
                    return
                }

                if (segments.length > 0) {
                    const lastSegment = segments[segments.length - 1]
                    if (!currentState) {
                        currentState = {}
                    }
                    currentState.time = lastSegment.end !== undefined ? lastSegment.end : lastSegment.start
                    currentState.state = lastSegment.state
                }

                // Update status with the color and value of the current state
                let stateColor = 'grey' // default
                let stateText = 'none'

                if (currentState && currentState.state) {
                    // Try to find the color from the states config if available
                    const stateConfig = (config.states || []).find(s => s.value === currentState.state)
                    const hexColor = stateConfig && stateConfig.color ? stateConfig.color : '#009933' // fallback to green
                    stateColor = mapHexToStatusFill(hexColor)
                    stateText = String(currentState.state)
                }

                node.status({
                    shape: 'dot',
                    fill: stateColor,
                    text: stateText
                })

                base.stores.data.save(base, node, msg)
                base.emit('widget-sync:' + node.id, msg, node, null) // let all other connect clients now about the value change

                // Forward the message to the dashboard
                node.send(msg)
            } catch (err) {
                node.error(`Error processing message: ${err.message}`, msg)
                node.status({
                    shape: 'ring',
                    fill: 'red',
                    text: 'error'
                })
            }
        })

        /**
         * Processes a single state input, updating the current state and adding completed segments
         * to the `segments` array.
         *
         * @param {object} data - The input data object.
         * @param {number} data.time - The timestamp of the state occurrence (e.g., milliseconds).
         * @param {string|number|boolean} data.state - The state value at the given time.
         */
        function processSingleInput (data) {
            const { time, state } = data
            // --- Validation ---
            if (typeof time !== 'number' || state === undefined || state === null || state === '') {
                node.error('Invalid input: "time" must be a number and "state" must be provided and non-empty.')
                return // Stop processing this invalid input
            }

            if (lastTimestamp !== null) {
                if (time < lastTimestamp) {
                    node.error(`Timestamp ${time} is earlier than the last processed timestamp ${lastTimestamp}. Input ignored.`)
                    return // Ignore out-of-order input
                }
                // Allow processing the same timestamp only if the state is different (instantaneous change)
                if (time === lastTimestamp && currentState && state === currentState.state) {
                    node.debug(`Ignoring duplicate state '${state}' at identical timestamp ${time}.`)
                    return // Ignore redundant input (same state, same time)
                }
            }

            // Validate against allowed states if configured
            if (allowedStates && allowedStates.length > 0 && !allowedStates.includes(state)) {
                node.error(`Invalid state '${state}' provided at time ${time}. Allowed values are: ${allowedStates.join(', ')}. Input ignored.`)
                return // Ignore invalid state
            }
            // --- End Validation ---

            // --- Core State Transition Logic ---
            // Get the last segment, if any
            const lastSegment = segments.length > 0 ? segments[segments.length - 1] : null

            if (lastSegment && state === lastSegment.state) {
                // State is the same as the last segment's state.
                // Update the end time of the last segment.
                if (time >= lastSegment.end) {
                    lastSegment.end = time
                    node.debug(`State '${state}' continued. Updated end time to ${time}.`)
                } else {
                    node.error(`Received same state '${state}' at time ${time}, which is before the current segment end time ${lastSegment.end}. Ignoring update.`)
                    return
                }
            } else {
                // State has changed, or this is the first segment.

                // --- Time Validation ---
                // Ensure the new state doesn't start before the previous one ended.
                if (lastSegment && time < lastSegment.end) {
                    node.error(`Cannot start new state '${state}' at time ${time} because it's before the previous segment ended at ${lastSegment.end}. Ignoring message.`)
                    return // Ignore message that would create overlapping segments
                }
                // --- End Time Validation ---

                // --- Update Previous Segment (if applicable) ---
                if (lastSegment) {
                    // Set the end time of the *previous* segment to the start time of the *new* one.
                    lastSegment.end = time
                    node.debug(`Finalized previous segment (state '${lastSegment.state}') end time to ${time}.`)
                }
                // --- End Update Previous Segment ---

                // --- Create and Add New Segment ---
                const newSegment = {
                    start: time, // Start time is the current message's time
                    end: time, // Initial end time is the same as start time
                    state
                }
                segments.push(newSegment)
                node.debug(`New state '${state}' started. Added new segment starting at ${time}.`)
                // --- End Create and Add New Segment ---
            }
            // --- End Core State Transition Logic ---

            // Update the last timestamp processed successfully
            lastTimestamp = time
        }

        /**
         * Processes an array of state inputs, updating the segments array.
         * Handles variable states, validates input, and ensures non-overlapping segments.
         * @param {Array} array - Array of {time, state}
         * @returns {Array} - Filtered segments within the window
         */
        function processArrayInput (array) {
            if (!Array.isArray(array) || !array.every(item => typeof item.time === 'number' && item.state !== undefined && item.state !== null && item.state !== '')) {
                node.error('Invalid array input: All items must have time (number) and non-empty state.')
                return []
            }

            // Sort by time to ensure chronological order
            const sorted = array.slice().sort((a, b) => a.time - b.time)
            const newSegments = []
            let lastSegment = null
            let lastTimestampLocal = null

            for (const item of sorted) {
                const { time, state } = item

                // --- Validation ---
                if (typeof time !== 'number' || state === undefined || state === null || state === '') {
                    node.error('Invalid input in array: "time" must be a number and "state" must be provided and non-empty.')
                    continue
                }

                if (lastTimestampLocal !== null) {
                    if (time < lastTimestampLocal) {
                        node.error(`Timestamp ${time} is earlier than the last processed timestamp ${lastTimestampLocal}. Input ignored.`)
                        continue
                    }
                    if (time === lastTimestampLocal && lastSegment && state === lastSegment.state) {
                        node.debug(`Ignoring duplicate state '${state}' at identical timestamp ${time} in array.`)
                        continue
                    }
                }

                // Validate against allowed states if configured
                if (allowedStates && allowedStates.length > 0 && !allowedStates.includes(state)) {
                    node.error(`Invalid state '${state}' provided at time ${time} in array. Allowed values are: ${allowedStates.join(', ')}. Input ignored.`)
                    continue
                }
                // --- End Validation ---

                // --- Core State Transition Logic ---
                if (lastSegment && state === lastSegment.state) {
                    // State is the same as the last segment's state.
                    // Update the end time of the last segment.
                    if (time >= lastSegment.end) {
                        lastSegment.end = time
                        node.debug(`State '${state}' continued in array. Updated end time to ${time}.`)
                    } else {
                        node.error(`Received same state '${state}' at time ${time} in array, which is before the current segment end time ${lastSegment.end}. Ignoring update.`)
                        continue
                    }
                } else {
                    // State has changed, or this is the first segment.

                    // --- Time Validation ---
                    if (lastSegment && time < lastSegment.end) {
                        node.error(`Cannot start new state '${state}' at time ${time} in array because it's before the previous segment ended at ${lastSegment.end}. Ignoring message.`)
                        continue
                    }
                    // --- End Time Validation ---

                    // --- Update Previous Segment (if applicable) ---
                    if (lastSegment) {
                        lastSegment.end = time
                        node.debug(`Finalized previous segment (state '${lastSegment.state}') end time to ${time} in array.`)
                    }
                    // --- End Update Previous Segment ---

                    // --- Create and Add New Segment ---
                    const newSegment = {
                        start: time,
                        end: time,
                        state
                    }
                    newSegments.push(newSegment)
                    lastSegment = newSegment
                    node.debug(`New state '${state}' started in array. Added new segment starting at ${time}.`)
                    // --- End Create and Add New Segment ---
                }
                lastTimestampLocal = time
            }

            // Filter out segments older than the window
            return filterSegmentsByRange(newSegments, rangeLimit, rangeLimitUnit)
        }

        // Event handlers for dashboard registration
        const evts = {
            beforeSend: function (msg) {
                // Handled in node.on('input') above
                return msg
            }
        }

        // Register the node with the dashboard
        if (group && base) {
            group.register(node, config, evts)
        } else {
            node.error('No group configured')
            node.status({
                shape: 'ring',
                fill: 'red',
                text: 'no group'
            })
        }
    }

    RED.nodes.registerType('ui-state-timeline', StateTimelineNode)
}
