# Design a Home Automation System (LLD)

A home automation system enables remote control and scheduling of household devices (lights, thermostats, locks, cameras). This tests the Command pattern (execute/undo device actions), Observer pattern (sensor events), and Composite pattern (device groups).

---

## 1. Requirements

### Functional Requirements
- **Device Management:** Register devices — lights, thermostats, locks, cameras, fans.
- **Remote Control:** Turn devices on/off, adjust settings (brightness, temperature) from a central controller.
- **Grouping:** Create device groups (e.g., "Living Room") and control all devices in a group at once.
- **Scheduling:** Schedule actions (e.g., "Turn off all lights at 11 PM").
- **Automation Rules:** Trigger actions based on sensor events (e.g., "If motion detected → turn on lights").
- **Undo:** Undo the last action.

### Non-Functional Requirements
- **Extensibility:** Adding new device types should not require modifying existing code.
- **Thread-Safety:** Scheduled tasks and sensor events run on separate threads.

---

## 2. Core Entities

- `HomeAutomationSystem` — singleton, manages all devices and rules
- `Device` (Interface) → `Light`, `Thermostat`, `SmartLock`, `Camera`, `Fan`
- `DeviceGroup` — composite of devices (Composite pattern)
- `Command` (Interface) → `TurnOnCommand`, `TurnOffCommand`, `SetTemperatureCommand`
- `RemoteController` — executes commands, maintains undo stack
- `Schedule` — time-based trigger for commands
- `AutomationRule` — event-condition-action: when [sensor event], if [condition], do [command]
- `Sensor` (Interface) → `MotionSensor`, `TemperatureSensor`, `DoorSensor`
- `SensorEventListener` (Interface) — Observer for sensor events

---

## 3. Key Design Decisions

### Command Pattern for Device Actions

```java
public interface Command {
    void execute();
    void undo();
}

public class TurnOnCommand implements Command {
    private Device device;
    public TurnOnCommand(Device device) { this.device = device; }
    public void execute() { device.turnOn(); }
    public void undo() { device.turnOff(); }
}

// Remote controller with undo stack
public class RemoteController {
    private Deque<Command> history = new ArrayDeque<>();

    public void executeCommand(Command cmd) {
        cmd.execute();
        history.push(cmd);
    }

    public void undo() {
        if (!history.isEmpty()) history.pop().undo();
    }
}
```

### Composite Pattern for Device Groups

```java
public interface Controllable {
    void turnOn();
    void turnOff();
}

public class Light implements Controllable { /* ... */ }
public class DeviceGroup implements Controllable {
    private List<Controllable> devices; // lights, fans, or sub-groups
    public void turnOn() { devices.forEach(Controllable::turnOn); }
    public void turnOff() { devices.forEach(Controllable::turnOff); }
}
```

### Observer Pattern for Sensor Events

```java
public class MotionSensor {
    private List<SensorEventListener> listeners = new ArrayList<>();

    public void onMotionDetected() {
        listeners.forEach(l -> l.onEvent(new SensorEvent("MOTION", this)));
    }
}
```

---

## 4. Patterns Used

| Pattern    | Where Used                                     |
|------------|------------------------------------------------|
| Command    | Device actions with undo support               |
| Composite  | Device groups (control all at once)            |
| Observer   | Sensor events triggering automation rules      |
| Strategy   | Scheduling strategies (one-time, recurring)    |
| Singleton  | HomeAutomationSystem as central controller     |
