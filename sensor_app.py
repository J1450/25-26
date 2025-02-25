from flask import Flask, render_template, request, jsonify, send_file, make_response
from flask_socketio import SocketIO
from random import random
from threading import Lock
from datetime import datetime
import time

import weasyprint
import serial
import webview

arduino = serial.Serial( "COM8", 9600, timeout=0)

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
    0: 
        {'Medications': {'count': 0, 'steps': [('Place IV #1', 1), ('Give Epi', 2)]},
        'Compressions': [('CPR', 0)],
        'Airways': [('Place Oxygen', 1)]
        },
    1: 
        {'Medications': [('Give Epi', 2), ('Give Amiodarone', 3), ],
        'Compressions': [('Shock', 0), ('CPR', 0)],
        'Airways': [('Listen to lungs'), ('Place IV #2', 1)]
        },
    2: 
        {'Medications': [('Give Bicarbonate', 4), ('EKG', 0)],
        'Compressions': [('Check Blood Pressure', 0), ('Order CXR', 0)],
        'Airways': [('Listen to lungs', 0), ('Call ICU', 0), ('Consult cardiology', 0)]
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

# @app.route('/record_interaction', methods=['POST'])
# def record_interaction():
#     timestamp = request.form.get('timestamp')
#     text = request.form.get('text')
#     person = request.form.get('person')
#     interactions.append([text, timestamp, person])
#     return jsonify({'status': 'success'})

# @app.route('/generate_pdf', methods=['GET'])
# def generate_pdf():
#     html_content = '<h1>Recorded Interactions</h1>'
#     for interaction in interactions:
#         html_content += f'<p>{interaction}</p>'
#     pdf = weasyprint.HTML(string=html_content).write_pdf()
#     # Provide the PDF file for download
#     response = make_response(pdf)
#     response.headers['Content-Type'] = 'application/pdf'
#     response.headers['Content-Disposition'] = 'attachment; filename=recorded_interactions.pdf'
#     return response

"""
Tasks
"""
@app.route('/obtain_status', methods=['POST'])
def obtain_status():
    try:
        scenario = int(request.form.get('scenario'))
        category = request.form.get('category')
        
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            count = step_info['count']
            if count < len(step_info['steps']):
                step = step_info['steps'][count]
                return jsonify({'success': True, 'step': step})
        
        return jsonify({'success': False, 'message': 'Scenario or category not found or no steps available'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/undo_step', methods=['POST'])
def undo_step():
    try:
        scenario = int(request.form.get('scenario'))
        category = request.form.get('category')
        
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            
            if isinstance(step_info, dict) and step_info['count'] > 0:
                step_info['count'] -= 1
                return jsonify({'success': True, 'message': 'Step undone successfully'})
        
        return jsonify({'success': False, 'message': 'Scenario or category not found or no steps to undo'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500



@app.route('/update_status', methods=['POST'])
def update_status():
    try:
        scenario = int(request.form.get('scenario'))
        category = request.form.get('category')
        
        if scenario in tasks and category in tasks[scenario]:
            step_info = tasks[scenario][category]
            
            if isinstance(step_info, dict) and step_info['count'] < len(step_info['steps']):
                step_info['count'] += 1
                return jsonify({'success': True, 'message': 'Status updated successfully'})
        
        return jsonify({'success': False, 'message': 'Scenario or category not found or already completed'}), 404
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