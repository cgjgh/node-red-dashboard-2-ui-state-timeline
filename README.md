
# State Timeline Node for Node-RED Dashboard 2.0

The State Timeline node visualizes the history of state changes over time, making it easy to track and analyze how a device, process, or variable has changed states throughout a given period.

## 🚦 What is the State Timeline Node?

The State Timeline node displays a horizontal timeline bar in your Dashboard, where each segment represents a period during which a particular state was active. It is ideal for visualizing on/off cycles, process states, sensor readings, or any discrete state transitions.

![Overview](https://github.com/cgjgh/node-red-dashboard-2-ui-state-timeline/blob/5c19b8da00e14db20e22d2ac63d9cc55127cefd5/assets/overview.png?raw=true)

---

## ✨ Features

- **Visual State History:** See a clear, color-coded timeline of state changes.
- **Customizable States:** Define your own states, labels, and colors.
- **Flexible Time Range:** Limit the displayed history to a configurable window (e.g., last 24 hours).
- **Live Updates:** Optionally update the end time of the current state segment in real time.
- **Time Markers:** Show time labels at segment boundaries or only at the start/end.
- **Detailed Tooltips:** Hover over segments to see start/end times and durations.
- **Dashboard Integration:** Seamless integration with Node-RED Dashboard 2.0.
- **Persistent State:** Timeline history is preserved across Node-RED restarts.
- **Multi-language Support:** UI labels and configuration support multiple languages.

---

## 📦 Installation

You can install this node directly from the **Manage Palette** menu in Node-RED.

Or, from your Node-RED user directory (typically `~/.node-red`):

```sh
npm install @cgjgh/node-red-dashboard-2-ui-state-timeline
```

---

## 🛠️ Node Configuration

### Node Properties

- **Group:** Dashboard group to display the timeline in (required).
- **Name:** Optional name for the node.
- **Label:** Title shown above the timeline bar.
- **Bar Height:** Height of the timeline bar (in pixels).
- **States:** Define the possible states, each with:
  - **Label:** Human-readable name.
  - **Value:** The value to match in incoming messages.
  - **Type:** Data type (`str`, `num`, `bool`, `json`).
  - **Color:** Color for the timeline segment.
- **Time Format:** Format for time labels (e.g., `h:mm A`, `HH:mm`).
- **Min Label Gap (%):** Minimum percentage gap between time labels.
- **Time Range Limit:** How much history to display (e.g., 24).
- **Time Range Unit:** Unit for the range (seconds, minutes, hours, days, weeks).
- **Live Update:** If enabled, the current segment's end time updates every 5 seconds.
- **Show Time Markers:** Show time labels at segment boundaries.
- **Show Only Start/End Times:** Only show time at the start and end of the timeline.

### Example UI

![Details](https://github.com/cgjgh/node-red-dashboard-2-ui-state-timeline/blob/5c19b8da00e14db20e22d2ac63d9cc55127cefd5/assets/details.gif?raw=true)

---

## 🔗 Usage

1. **Add the node** to your flow and connect it to the data source whose state you want to visualize.
2. **Configure the states** you want to track (e.g., On/Off, Open/Closed, etc.).
3. **Send messages** to the node with the following payload formats:

### Input Message Formats

#### Payload Field Explanations

- `time`: Unix timestamp in milliseconds (e.g., `1710000000000`)
- `state`: Value matching one of your configured states (e.g., `"on"`)

#### Single State Change

```json
{
  "payload": {
    "time": 1710000000000,
    "state": "on"
  }
}
```

#### Array of State Changes

```json
{
  "payload": [
    { "time": 1710000000000, "state": "on" },
    { "time": 1710003600000, "state": "off" },
    { "time": 1710007200000, "state": "on" }
  ]
}
```

- The node will build the timeline from the provided state changes.
- Timestamps must be in milliseconds (JavaScript Date format).

### Output

- The node outputs the current timeline as:
  ```json
  {
    "payload": {
      "stateData": [
        { "start": "2024-03-09T10:00:00.000Z", "end": "2024-03-09T11:00:00.000Z", "state": "on" }
      ]
    }
  }
  ```
- This can be used for further processing or logging.

---

## 🖥️ Dashboard Display

- Each state is shown as a colored segment.
- Hovering over a segment shows a tooltip with:
  - State label
  - Start time
  - End time
  - Duration
- Time markers are shown according to your configuration.
- 
---

## 🧑‍💻 Development & Contributions

- This node is under active development. Feedback and contributions are welcome!
- Please open issues or pull requests on [GitHub](https://github.com/cgjgh/node-red-dashboard-2-ui-state-timeline).

---

## ☕ Support

If you find this node useful, please consider supporting development:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/arial-blue.png)](https://www.buymeacoffee.com/cgjgh)

---

## 📚 License

[Apache-2.0](LICENSE)

