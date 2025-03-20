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

@app.route('/start_code', methods=['GET'])
def code_blue():
    global interactions
    now = datetime.now()
    interactions.append(["Code Initiated", now.strftime("%m/%d/%Y %H:%M:%S")])
    
    # Send START signal to Arduino
    arduino.write("START\n".encode())
    
    return render_template('code_blue.html', tasks = tasks)

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
    # First, turn off all drawer lights
    for i in range(1, 5):
        arduino.write(f"{i},OFF\n".encode())
    
    # Then turn on lights for all pending tasks
    for cat in tasks[scenario]:
        cat_info = tasks[scenario][cat]
        if cat_info['count'] < len(cat_info['steps']):
            next_step = cat_info['steps'][cat_info['count']][0]
            if "Place IV" in next_step or "Place Oxygen" in next_step:
                arduino.write("1,{}\n".format(next_step).encode())
            elif "Give Epi" in next_step:
                arduino.write("2,{}\n".format(next_step).encode())
            elif "Give Amiodarone" in next_step:
                arduino.write("3,{}\n".format(next_step).encode())
            elif "Give Bicarbonate" in next_step:
                arduino.write("4,{}\n".format(next_step).encode())

@app.route('/update_status', methods=['POST'])
def update_status():
    try:
        scenario = int(request.form.get('scenario'))
        category = request.form.get('category')
        
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            
            if step_info['count'] < len(step_info['steps']):
                step_info['count'] += 1
                
                # Record the interaction
                timestamp = datetime.now().strftime("%m/%d/%Y %H:%M:%S")
                current_step = step_info['steps'][step_info['count'] - 1][0]
                scenario_names = {0: 'Asystole', 1: 'Ventricular Fibrillation', 2: 'Normal Sinus'}
                scenario_name = scenario_names.get(scenario, f'Scenario {scenario}')
                text = f"[{scenario_name}] {category} - Completed: {current_step}"
                
                # Only append if this exact interaction isn't the last one recorded
                if not interactions or interactions[-1][0] != text:
                    interactions.append([text, timestamp])
                    
                    # Update all drawer lights based on current state
                    update_drawer_lights(scenario)
                
                return jsonify({
                    'success': True,
                    'message': 'Status updated successfully',
                    'current_count': step_info['count'],
                    'total_steps': len(step_info['steps'])
                })
            return jsonify({'success': False, 'message': 'All tasks completed'}), 200
        
        return jsonify({'success': False, 'message': 'Invalid scenario or category'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

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

if __name__ == '__main__':
    #socketio.run(app)
    webview.start(window)


