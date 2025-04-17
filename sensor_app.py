from flask import Flask, render_template, request, jsonify, send_file, make_response
from flask_socketio import SocketIO
from random import random
from threading import Lock
from datetime import datetime
import time
import os
from pathlib import Path

import weasyprint
import serial
import webview

arduino = serial.Serial( "COM7", 9600, timeout=0)

''' 
My variables
'''
ledPosition = 0
buttonClicks = 0
stepNumber = 1
oldScenario = 0
stepNumbers = {'Asystole': 1,
               'Ventricular Fibrillation': 1,
               'Normal Sinus': 1}

'''
Data Structures
'''

# 3 possible state
   # Medications list
   # Compressions list
   # Airways list

tasks = {
    0: {
        'Medications': {'count': 0, 'steps': [('Place IV #1', 1), ('Give Epi', 2)]},
        'Compressions': {'count': 0, 'steps': [('CPR', 0)]},
        'Airways': {'count': 0, 'steps': [('Place Oxygen', 1)]}
    },
    1: {
        'Medications': {'count': 0, 'steps': [('Give Epi', 2), ('Give Amiodarone', 3)]},
        'Compressions': {'count': 0, 'steps': [('Shock', 0), ('CPR', 0)]},
        'Airways': {'count': 0, 'steps': [('Listen to lungs', 0), ('Place IV #2', 1)]}
    },
    2: {
        'Medications': {'count': 0, 'steps': [('Give Bicarbonate', 4), ('EKG', 0)]},
        'Compressions': {'count': 0, 'steps': [('Check Blood Pressure', 0), ('Order CXR', 0)]},
        'Airways': {'count': 0, 'steps': [('Listen to lungs', 0), ('Call ICU', 0), ('Consult cardiology', 0)]}
    }
}

interactions = []
# tasks = {
#     1:{'person1':{'task': 'Place IV #1', 'status': 'ongoing', 'timer': 120, 'drawer': 1},
#        'person2':{'task': 'CPR', 'status': 'ongoing', 'timer': 120, 'drawer': 0},
#        'person3':{'task': 'Place Oxygen', 'status': 'pending', 'timer': 120, 'drawer': 1}},

#     2:{'person1': {'task': 'Give Epi', 'status': 'pending', 'timer': 120, 'drawer': 0},
#        'person2':{'task': 'CPR', 'status': 'pending', 'timer': 120, 'drawer': 2},
#        'person3': {'task': 'Place Oxygen', 'status': 'pending', 'timer': 30, 'drawer':3}},

#     3:{'person1': {'task': 'Resume compressions', 'status': 'ongoing', 'timer': 120, 'drawer': 0},
#        'person2':{'task': 'Auscultate to chest sounds', 'status': 'pending', 'timer': 60, 'drawer': 0},
#        'person3':{'task': 'Administer hypomagnesia (2 G) and bicarbonate (1 amp) (Mg = 0.2; pH = 7.2)', 'status': 'pending', 'timer': 60, 'drawer':3}},
    
#     4:{'person1': {'task': 'Stop compressions and check rhythm (Shock with 200J)', 'status': 'pending', 'timer': 60, 'drawer': 0},
#        'person2':{'task': 'Standby', 'status': 'pending', 'timer': 60, 'drawer': 0},
#        'person3':{'task': 'Administer amiodarone IV push (300 mg)', 'status': 'pending', 'timer': 60, 'drawer': 3}},
    
#     5:{'person1': {'task': 'Check pulse with compressions', 'status': 'ongoing', 'timer': 30, 'drawer': 0},
#        'person2':{'task': 'Standby 1', 'status': 'pending', 'timer': 60, 'drawer': 0},
#        'person3':  {'task': 'Administer epinephrine (1 mg) IV push and flush   ', 'status': 'pending', 'timer': 30, 'drawer': 3}},

#     6:{'person1':{'task': 'Stop compressions and check rhythm (Rhythm is back to STEM)', 'status': 'pending', 'timer': 60, 'drawer': 0},
#        'person2':{'task': 'Standby 2', 'status': 'pending', 'timer': 60, 'drawer': 0},
#        'person3':{'task': 'Standby 3', 'status': 'pending', 'timer': 60, 'drawer': 0}},
# }

"""
Background Thread       
"""
thread = None
thread_lock = Lock()

app = Flask(__name__, static_folder="./static", template_folder="./templates")
socketio = SocketIO(app, cors_allowed_origins='*')

"""
Get current date time
"""
def get_current_datetime():
    now = datetime.now()
    return now.strftime("%m/%d/%Y %H:%M:%S")

"""
Serve root index file
"""
@app.route('/')
def index():
    return render_template("index.html")

@app.route('/start_code')
def start_code():
    global interactions, cpr_active
    try:
        # Get the initial scenario from query parameters, default to 0 (Asystole)
        initial_scenario = int(request.args.get('scenario', '0'))
        
        # Stop CPR lights if they're active
        if cpr_active:
            print("Stopping CPR lights before starting new scenario")
            arduino.write("STOP\n".encode())
            arduino.flush()
            cpr_active = False
        
        # Record the start of code blue
        now = datetime.now()
        scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
        scenario_name = scenario_names.get(initial_scenario, f'Scenario {initial_scenario}')
        interactions.append([f"Code Initiated - {scenario_name}", now.strftime("%m/%d/%Y %H:%M:%S")])
        
        # Reset task counts for the selected scenario
        if initial_scenario in tasks:
            update_drawer_lights(initial_scenario)
            scenario_tasks = tasks[initial_scenario]
            # Reset counts for each category
            for category in scenario_tasks:
                scenario_tasks[category]['count'] = 0
            
            return render_template('code_blue.html', 
                                tasks=scenario_tasks,
                                initial_scenario=initial_scenario)
        else:
            return jsonify({'success': False, 'message': 'Invalid scenario'}), 400
            
    except Exception as e:
        print(f"Error in start_code: {str(e)}")  # Log the error
        return jsonify({'success': False, 'message': str(e)}), 500

"""
Communication between Python and HTML
"""
# @app.route('/turn_off_led_undo', methods=['POST'])
# def turnoffledundo():
#     global stepNumbers
#     category = request.form.get('category')
#     stepNumber = stepNumbers[category]
#     if stepNumber > 1: 
#         drawerNumber = tasks[stepNumber+1][category]['drawer']
#         strInput = str(drawerNumber) + "," + category[-1]
#         print(strInput)
#         arduino.write(strInput.encode())
            
#     return jsonify({'status': 'success'})

# @app.route('/turn_off_led', methods=['POST'])
# def turnoffled():
#     global stepNumbers
#     person = request.form.get('person')
#     stepNumber = stepNumbers[person]
#     if stepNumber > 1: 
#         drawerNumber = tasks[stepNumber-1][person]['drawer']
#         strInput = str(drawerNumber) + "," + person[-1]
#         print(strInput)
#         arduino.write(strInput.encode())
            
#     return jsonify({'status': 'success'})

# @app.route('/change_led', methods=['POST'])
# def changeled():
#     global stepNumbers
#     person = request.form.get('person') 
#     stepNumber = stepNumbers[person]
#     drawerNumber = tasks[stepNumber][person]['drawer']
#     strInput = str(drawerNumber) + "," + person[-1]
#     arduino.write(strInput.encode())
#     print(strInput)
#     return jsonify({'status': 'success'})

@app.route('/record_interaction', methods=['POST'])
def record_interaction():
    global interactions
    try:
        timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
        category = request.form.get('category')
        action = request.form.get('action')  # 'complete' or 'undo'
        scenario = request.form.get('scenario')
        
        # Get the task name
        scenario_int = int(scenario)
        if scenario_int in tasks and category in tasks[scenario_int]:
            step_info = tasks[scenario_int][category]
            current_step = step_info['steps'][step_info['count'] - 1 if action == 'complete' else step_info['count']][0]
            
            # Format the interaction text
            scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
            scenario_name = scenario_names.get(scenario_int, f'Scenario {scenario}')
            text = f"[{scenario_name}] {category} - {'Completed' if action == 'complete' else 'Undid'}: {current_step}"
            
            # Only append if this exact interaction isn't the last one recorded
            if not interactions or interactions[-1][0] != text:
                interactions.append([text, timestamp])
            return jsonify({'success': True, 'message': 'Interaction recorded'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/generate_pdf', methods=['GET'])
def generate_pdf():
    try:
        # Create HTML content
        html_content = '''
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #2c3e50; text-align: center; }
                .interaction { 
                    margin: 10px 0;
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                }
                .timestamp {
                    color: #7f8c8d;
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <h1>Code Blue Event Record</h1>
        '''
        
        # Add interactions (ensure no duplicates)
        seen_interactions = set()
        for interaction in interactions:
            text, timestamp = interaction
            if text not in seen_interactions:
                seen_interactions.add(text)
                html_content += f'''
                <div class="interaction">
                    <div>{text}</div>
                    <div class="timestamp">{timestamp}</div>
                </div>
                '''
        
        html_content += '''
        </body>
        </html>
        '''
         
        # Generate PDF with a specific filename
        filename = f'code_blue_record_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        
        # Get user's Downloads folder
        downloads_path = str(Path.home() / "Downloads")
        pdf_path = os.path.join(downloads_path, filename)
        
        # Generate and save PDF directly to Downloads folder
        pdf = weasyprint.HTML(string=html_content).write_pdf()
        with open(pdf_path, 'wb') as f:
            f.write(pdf)
        
        return jsonify({
            'success': True,
            'message': f'PDF saved to Downloads folder as {filename}',
            'path': pdf_path
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

"""
Tasks
"""
@app.route('/obtain_status', methods=['POST'])
def obtain_status():
    try:
        scenario = int(request.form.get('scenario'))
        category = request.form.get('category')

        # if oldScenario != scenario:
        #     scenario_tasks = tasks[scenario]
        #     # Reset counts for each category
        #     for category in scenario_tasks:
        #         scenario_tasks[category]['count'] = 0
        #     update_drawer_lights(scenario)
        #     oldScenario = scenario

        
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
        
        return jsonify({'success': False, 'message': 'Invalid category'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

def update_drawer_lights(scenario):
    arduino.flush() 
    # # First, turn off all drawer lights
    # for i in range(1, 5):
    #     arduino.write(f"{i},OFF\n".encode())
    
    # Then turn on lights for all pending tasks
    # Each provider in the scenario
    print("----------UPDATE DRAWER LIGHTS IS CALLED----------")
    print(scenario)
    message = ""
    for cat in tasks[scenario]:
        # Every task that the provider needs to do in order
        cat_info = tasks[scenario][cat]

        print("Cat info")
        print(cat_info)
        
        # if we still have tasks left to do for that provider
        if cat_info['count'] < len(cat_info['steps']):
            
            next_step = cat_info['steps'][cat_info['count']][0]
            print("Next step")
            print(next_step)
            
        
            if "Place IV" in next_step or "Place Oxygen" in next_step:
                message += "DRAWER1"
                # arduino.write("DRAWER1\n".encode())
                # arduino.flush()
                # print("1")
            if "Place Oxygen" in next_step:
                message += "DRAWER5"
                # arduino.write("DRAWER1\n".encode())
                # arduino.flush()
                # print("1")
            if "Give Epi" in next_step:
                message += "DRAWER2"
                # arduino.write("DRAWER2\n".encode())
                # arduino.flush()
                # print("2")
            if "Give Amiodarone" in next_step:
                message += "DRAWER3"
                # arduino.write("DRAWER3\n".encode())
                # arduino.flush()
                # print("3")
            if "Give Bicarbonate" in next_step:
                message += "DRAWER4"
                # arduino.write("DRAWER4\n".encode())
                # arduino.flush()
                # print("4")

    message += "\n"
    if (message != "\n"): print(message)
    arduino.write(message.encode())
    arduino.flush()

# Add global variable for CPR state
cpr_active = False

@app.route('/update_status', methods=['POST'])
def update_status():
    global stepNumber, cpr_active
    category = request.form.get('category')
    scenario = int(request.form.get('scenario', 0))
    action = request.form.get('action')

    global oldScenario
    scenario = int(request.form.get('scenario', 0))
    # detect real scenario change
    if oldScenario is None or scenario != oldScenario:
        # 1) reset counts for the new scenario
        for cat in tasks[scenario]:
            tasks[scenario][cat]['count'] = 0

        # 2) update lights based on those fresh counts
        update_drawer_lights(scenario)

        oldScenario = scenario
    
    try:
        print(f"Received update_status request - Category: {category}, Scenario: {scenario}, Action: {action}, CPR Active: {cpr_active}")
        
        # Handle CPR task signals
        if action == 'cpr_start':
            print("Starting CPR lights")  # Debug log
            cpr_active = True
            # Send START signal to Arduino for CPR lights
            arduino.write("START\n".encode())
            arduino.flush()  # Force flush the buffer
            time.sleep(0.1)  # Small delay to ensure command is sent
            print("START signal sent to Arduino")
            return jsonify({'success': True})
            
        elif action == 'cpr_stop':
            print("Stopping CPR lights")  # Debug log
            cpr_active = False
            # Send STOP signal to Arduino for CPR lights and wait for confirmation
            print("Sending STOP signal to Arduino")
            arduino.write("STOP\n".encode())
            arduino.flush()  # Force flush the buffer
            
            # Wait for confirmation (with timeout)
            start_time = time.time()
            while time.time() - start_time < 1.0:  # 1 second timeout
                if arduino.in_waiting:
                    response = arduino.readline().decode().strip()
                    print(f"Received response from Arduino: {response}")  # Debug log
                    if response == "CPR_STOPPED":
                        print("Received CPR_STOPPED confirmation")
                        return jsonify({'success': True})
                time.sleep(0.1)
            
            print("Timeout waiting for CPR_STOPPED confirmation")
            # If we didn't get confirmation, return failure
            return jsonify({
                'success': False,
                'message': 'Did not receive confirmation of CPR stop'
            })
        
        # Record the interaction and update task count
        if category in tasks[scenario]:
            step_info = tasks[scenario][category]
            if step_info['count'] < len(step_info['steps']):
                # Update task count
                step_info['count'] += 1 
                
                current_task = step_info['steps'][step_info['count'] - 1][0]
                # Update drawer lights if needed
                update_drawer_lights(scenario)

                now = datetime.now()
                interactions.append([f"{category}: {current_task}", now.strftime("%m/%d/%Y %H:%M:%S")])
            
                
                return jsonify({
                    'success': True,
                    'message': 'Task updated successfully',
                    'current_count': step_info['count'],
                    'total_steps': len(step_info['steps'])
                })
            
            return jsonify({
                'success': True,
                'message': 'All tasks completed'
            })
        
        return jsonify({
            'success': False,
            'message': 'Invalid category or scenario'
        })
    
    except Exception as e:
        print(f"Error in update_status: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        })

@app.route('/undo_step', methods=['POST'])
def undo_step():
    try:
        scenario = int(request.form.get('scenario'))
        category = request.form.get('category')
        
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            
            if step_info['count'] > 0:
                # Record the interaction before decrementing the count
                timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
                current_step = step_info['steps'][step_info['count'] - 1][0]
                scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
                scenario_name = scenario_names.get(scenario, f'Scenario {scenario}')
                text = f"[{scenario_name}] {category} - Undid: {current_step}"
                
                # Only append if this exact interaction isn't the last one recorded
                if not interactions or interactions[-1][0] != text:
                    interactions.append([text, timestamp])
                
                step_info['count'] -= 1
                
                # Update all drawer lights based on current state
                update_drawer_lights(scenario)
                
                return jsonify({
                    'success': True,
                    'message': 'Step undone successfully',
                    'current_count': step_info['count'],
                    'total_steps': len(step_info['steps'])
                })
            return jsonify({'success': False, 'message': 'No steps to undo'}), 200
        
        return jsonify({'success': False, 'message': 'Invalid scenario or category'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

window = webview.create_window('ResQ Carts', app, fullscreen = True)

@app.route('/close_window', methods=['POST'])
def destroy():
    global window
    window.destroy()


"""
Decorator for connect and disconnect
"""
@socketio.on('connect')
def connect():
    global thread
    print('Client connected')

    global thread
    with thread_lock:
        if thread is None:
            thread = socketio.start_background_task(background_thread)

@socketio.on('disconnect')
def disconnect():
    print('Client disconnected',  request.sid)

@app.route('/upload_page')
def upload_page():
    return render_template('upload_page.html')

if __name__ == '__main__':
    #socketio.run(app)
    webview.start(window)



