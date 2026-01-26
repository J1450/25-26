from flask import Flask, render_template, request, jsonify, Response
from datetime import datetime
import threading
import serial
import time

app = Flask(__name__)

# Task data structure
tasks = {
    0: {
        'Medications': {'count': 0, 'steps': [('Place IV #1', 20), ('Give Epi', 15)]},
        'Compressions': {'count': 0, 'steps': []},
        'Airways': {'count': 0, 'steps': [('Place Oxygen', 20)]}
    },
    1: {
        'Medications': {'count': 0, 'steps': [('Give Epi', 15), ('Give Amiodarone', 10)]},
        'Compressions': {'count': 0, 'steps': [('Shock', 20)]},
        'Airways': {'count': 0, 'steps': [('Listen to lungs', 20), ('Place IV #2', 15)]}
    },
    2: {
        'Medications': {'count': 0, 'steps': [('Give Bicarbonate', 10), ('EKG', 20)]},
        'Compressions': {'count': 0, 'steps': [('Check Blood Pressure', 15), ('Order CXR', 10)]},
        'Airways': {'count': 0, 'steps': [('Listen to lungs', 20), ('Call ICU', 15), ('Consult cardiology', 10)]}
    }
}

interactions = []
current_scenario = 0

# Demo sensor states
sensor_states = {
    'iv_removed': False,
    'oxygen_removed': False
}

# Serial connection between arduino and pressure sensors
serial_connection = None

def find_arduino_port():
    """Find Arduino COM port"""
    return '/dev/cu.usbmodem101'

def read_serial_data():
    """Read data from Arduino in background thread"""
    global serial_connection, sensor_states
    while True:
        try:
            if serial_connection and serial_connection.in_waiting > 0:
                line = serial_connection.readline().decode('utf-8').strip()
                print(f"Received: {line}")
                
                if line.startswith("SENSOR:"):
                    # Parse sensor data
                    parts = line.split(":")
                    for part in parts[1:]:
                        if "=" in part:
                            key, value = part.split("=")
                            if key == "IV":
                                sensor_states['iv_removed'] = (value == "1")
                            elif key == "OXYGEN":
                                sensor_states['oxygen_removed'] = (value == "1")
                            
                    print(f"Updated sensor states: {sensor_states}")
        except Exception as e:
            print(f"Serial read error: {e}")
            time.sleep(1)

def init_serial():
    """Initialize serial connection to Arduino"""
    global serial_connection
    try:
        port = find_arduino_port()
        if port:
            serial_connection = serial.Serial(port, 9600, timeout=1)
            time.sleep(2)
            print(f"Connected to Arduino on {port}")
            
            # Start serial reading thread
            thread = threading.Thread(target=read_serial_data, daemon=True)
            thread.start()
            return True
    except Exception as e:
        print(f"Failed to connect to Arduino: {e}")
    return False

# Route for sensor updates
@app.route('/get_sensor_status', methods=['GET'])
def get_sensor_status():
    """Get current sensor status"""
    return jsonify({
        'success': True, 
        'sensors': sensor_states,
        'scenario': current_scenario
    })

# Route to check and update tasks based on sensors
@app.route('/check_tasks_from_sensors', methods=['GET'])
def check_tasks_from_sensors():
    """Check and update tasks based on sensor states"""
    global current_scenario, tasks, sensor_states
    
    if current_scenario != 0:  # Only for Asystole for now
        return jsonify({'success': False, 'message': 'Not in Asystole scenario'})
    
    updated_tasks = []
    
    # Check IV task
    if sensor_states['iv_removed']:
        # Check if "Place IV #1" in Medications is not already completed
        if 'Medications' in tasks[0]:
            med_tasks = tasks[0]['Medications']
            for i, (task_name, _) in enumerate(med_tasks['steps']):
                if task_name == 'Place IV #1' and i >= med_tasks['count']:
                    # Mark as completed
                    med_tasks['count'] = i + 1
                    updated_tasks.append({
                        'category': 'Medications',
                        'task': task_name,
                        'index': i
                    })
                    
                    # Record interaction
                    timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
                    interactions.append([f"[Asystole] Medications - Completed: {task_name} (via sensor)", timestamp])
                break
    
    # Check Oxygen task
    if sensor_states['oxygen_removed']:
        # Check if "Place Oxygen" in Airways is not already completed
        if 'Airways' in tasks[0]:
            airway_tasks = tasks[0]['Airways']
            for i, (task_name, _) in enumerate(airway_tasks['steps']):
                if task_name == 'Place Oxygen' and i >= airway_tasks['count']:
                    # Mark as completed
                    airway_tasks['count'] = i + 1
                    updated_tasks.append({
                        'category': 'Airways',
                        'task': task_name,
                        'index': i
                    })
                    
                    # Record interaction
                    timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
                    interactions.append([f"[Asystole] Airways - Completed: {task_name} (via sensor)", timestamp])
                break
    
    return jsonify({
        'success': True,
        'updated_tasks': updated_tasks,
        'sensor_states': sensor_states
    })

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/start_code')
def start_code():
    global current_scenario, interactions
    try:
        initial_scenario = int(request.args.get('scenario', '0'))
        current_scenario = initial_scenario
        interactions = [] 
        
        # Reset task counts for the selected scenario
        if initial_scenario in tasks:
            scenario_tasks = tasks[initial_scenario]
            for category in scenario_tasks:
                scenario_tasks[category]['count'] = 0
            
            # Record start interaction
            now = datetime.now()
            scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
            scenario_name = scenario_names.get(initial_scenario, f'Scenario {initial_scenario}')
            interactions.append([f"Code Initiated - {scenario_name}", now.strftime("%m/%d/%Y %H:%M:%S")])
            
            return render_template('new_code_blue.html', 
                                tasks=scenario_tasks,
                                initial_scenario=initial_scenario)
        else:
            return jsonify({'success': False, 'message': 'Invalid scenario'}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/update_status', methods=['POST'])
def update_status():
    global current_scenario, interactions
    try:
        category = request.form.get('category')
        scenario = int(request.form.get('scenario', current_scenario))
        
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            
            if step_info['count'] < len(step_info['steps']):
                # Get current task before updating count
                current_task = step_info['steps'][step_info['count']][0]
                current_timer = step_info['steps'][step_info['count']][1]
                
                # Update task count
                step_info['count'] += 1
                
                # Record interaction
                timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
                scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
                scenario_name = scenario_names.get(scenario, f'Scenario {scenario}')
                text = f"[{scenario_name}] {category} - Completed: {current_task}"
                interactions.append([text, timestamp])
                
                # Check if there are more tasks and return next one
                if step_info['count'] < len(step_info['steps']):
                    next_task = step_info['steps'][step_info['count']][0]
                    next_timer = step_info['steps'][step_info['count']][1]
                    return jsonify({
                        'success': True,
                        'step': [next_task, next_timer],
                        'current_count': step_info['count'],
                        'total_steps': len(step_info['steps'])
                    })
                else:
                    return jsonify({
                        'success': True,
                        'step': None,
                        'message': 'All tasks completed for this category',
                        'current_count': step_info['count'],
                        'total_steps': len(step_info['steps'])
                    })
            
            return jsonify({
                'success': True,
                'step': None,
                'message': 'All tasks already completed'
            })
        
        return jsonify({'success': False, 'message': 'Invalid category or scenario'}), 404
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/undo_step', methods=['POST'])
def undo_step():
    global current_scenario, interactions
    try:
        category = request.form.get('category')
        scenario = int(request.form.get('scenario', current_scenario))
        
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            
            if step_info['count'] > 0:
                # Get the task being undone
                undone_task = step_info['steps'][step_info['count'] - 1][0]
                
                # Update task count
                step_info['count'] -= 1
                
                # Record interaction
                timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
                scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
                scenario_name = scenario_names.get(scenario, f'Scenario {scenario}')
                text = f"[{scenario_name}] {category} - Undid: {undone_task}"
                interactions.append([text, timestamp])
                
                # Return the current task that should now be active
                current_task = step_info['steps'][step_info['count']][0]
                current_timer = step_info['steps'][step_info['count']][1]
                
                return jsonify({
                    'success': True,
                    'step': [current_task, current_timer],
                    'current_count': step_info['count'],
                    'total_steps': len(step_info['steps'])
                })
            
            return jsonify({'success': False, 'message': 'No steps to undo'}), 200
        
        return jsonify({'success': False, 'message': 'Invalid category or scenario'}), 404
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/obtain_status', methods=['POST'])
def obtain_status():
    global current_scenario
    try:
        category = request.form.get('category')
        scenario = int(request.form.get('scenario', current_scenario))
        
        if category == 'all':
            if scenario in tasks:
                scenario_tasks = {}
                for cat in tasks[scenario]:
                    scenario_tasks[cat] = {
                        'steps': tasks[scenario][cat]['steps'],
                        'count': tasks[scenario][cat]['count']
                    }
                return jsonify({
                    'success': True,
                    'tasks': scenario_tasks
                })
            return jsonify({'success': False, 'message': 'Scenario not found'}), 404
        
        # For individual category status
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            
            if step_info['count'] < len(step_info['steps']):
                current_task = step_info['steps'][step_info['count']][0]
                current_timer = step_info['steps'][step_info['count']][1]
                
                return jsonify({
                    'success': True,
                    'step': [current_task, current_timer],
                    'current_count': step_info['count'],
                    'total_steps': len(step_info['steps'])
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'No more tasks available'
                })
        
        return jsonify({'success': False, 'message': 'Invalid category or scenario'}), 404
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/record_interaction', methods=['POST'])
def record_interaction():
    global interactions
    try:
        timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
        category = request.form.get('category')
        action = request.form.get('action')
        scenario = request.form.get('scenario')
        
        scenario_int = int(scenario)
        if scenario_int in tasks and category in tasks[scenario_int]:
            step_info = tasks[scenario_int][category]
            if step_info['count'] > 0:
                current_step = step_info['steps'][step_info['count'] - 1][0]
                
                scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
                scenario_name = scenario_names.get(scenario_int, f'Scenario {scenario}')
                text = f"[{scenario_name}] {category} - {'Completed' if action == 'complete' else 'Undid'}: {current_step}"
                
                if not interactions or interactions[-1][0] != text:
                    interactions.append([text, timestamp])
                    
        return jsonify({'success': True, 'message': 'Interaction recorded'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/close_window', methods=['POST'])
def close_window():
    print("Close window requested")
    return jsonify({'success': True})

@app.route('/inventory')
def inventory_page():
    # return '<img src="/static/images/inventory.png" alt="Inventory">'
    return render_template('inventory.html')

@app.route('/download_page')
def download_page():
    """Render download page with all interactions"""
    scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
    return render_template('download_page.html', 
                         interactions=interactions,
                         scenario_names=scenario_names)

@app.route('/download_interactions_csv')
def download_interactions_csv():
    """Download interactions as CSV file"""
    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Timestamp', 'Interaction', 'Scenario'])
    
    # Data
    for interaction in interactions:
        # Try to extract scenario from interaction text
        scenario = "Unknown"
        interaction_text = interaction[0]
        
        if '[Asystole]' in interaction_text:
            scenario = 'Asystole'
        elif '[Ventricular Fibrillation]' in interaction_text:
            scenario = 'Ventricular Fibrillation'
        elif '[Normal Sinus]' in interaction_text:
            scenario = 'Normal Sinus'
        
        writer.writerow([interaction[1], interaction[0], scenario])
    
    output.seek(0)
    
    # Create filename with current timestamp
    filename = f"code_interactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )



@app.route('/get_interactions', methods=['GET'])
def get_interactions():
    return jsonify({'success': True, 'interactions': interactions})
    
@app.route('/record_task_completion', methods=['POST'])
def record_task_completion():
    global interactions
    try:
        timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
        category = request.form.get('category')
        task = request.form.get('task')
        scenario = int(request.form.get('scenario', current_scenario))
        action = request.form.get('action')
        elapsed_time = request.form.get('elapsed_time', 0)
        
        # Record the interaction
        scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
        scenario_name = scenario_names.get(scenario, f'Scenario {scenario}')
        text = f"[{scenario_name}] {category} - Completed: {task} at {elapsed_time}s"
        
        interactions.append([text, timestamp])
        
        return jsonify({'success': True, 'message': 'Task completion recorded'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    # Initialize serial connection

    if init_serial():
        print("Arduino serial connection initialized")
    else:
        print("Arduino not found, running without sensor support")
    
    print("Starting Code Cart Frontend Development Server")
    print("Access the application at: http://localhost:5001")
    print("Start a code blue at: http://localhost:5001/start_code?scenario=0")
    app.run(debug=True, host='0.0.0.0', port=5001)