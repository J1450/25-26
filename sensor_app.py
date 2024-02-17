from flask import Flask, render_template, request, jsonify, send_file, make_response
from flask_socketio import SocketIO
from random import random
from threading import Lock
from datetime import datetime

import os
from flask_weasyprint import HTML, render_pdf #must install GTK3 libraries and weasyprint
import weasyprint
import serial
import time

arduino = serial.Serial( "COM3", 9600, timeout=0.05)

''' 
My variables
'''
ledPosition = 0
buttonClicks = 0
stepNumber = 1

'''
Data Structures
'''
interactions = []
tasks = {
    1:{'person1':{'task': 'Administer epinephrine', 'status': 'pending', 'timer': 60}},
    2:{'person1': {'task': 'Check pulse', 'status': 'pending', 'timer': 10}},
    3:{'person1': {'task': 'Prepare medication', 'status': 'pending', 'timer': 30}},
}

"""
Background Thread
"""
thread = None
thread_lock = Lock()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'donsky!'
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
Obtain Sensor Data
"""
def background_thread():
    global buttonClicks
    while True:
        value = arduino.readline().decode('utf-8')
        value = value.strip("\n")
        value = value.strip("\r")
        if value.isdigit():
            buttonClicks = value
        socketio.emit('updateSensorData', {'value': buttonClicks, "date": get_current_datetime()})
        socketio.sleep(1)

'''
Passing Data Structures to JS
'''
@app.route('/get_task_timers', methods=['GET'])
def get_task_timers():
    return jsonify(tasks)


"""
Communication between Python and HTML
"""
@app.route('/change_led', methods=['POST'])
def changeled():
    global ledPosition
    ledPosition = request.form.get('led')  
    print(ledPosition)
    print(request.form.get('led'))
    arduino.write(str(ledPosition).encode())
    socketio.emit('updateSensorData', {'value': buttonClicks, "date": get_current_datetime()})
    return jsonify({'status': 'success'})

@app.route('/record_interaction', methods=['POST'])
def record_interaction():
    timestamp = request.form.get('timestamp')
    text = request.form.get('text')
    interactions.append([text, timestamp])
    print(interactions)
    return jsonify({'status': 'success'})

@app.route('/generate_pdf', methods=['GET'])
def generate_pdf():
    html_content = '<h1>Recorded Interactions</h1>'
    for interaction in interactions:
        html_content += f'<p>{interaction}</p>'
    pdf = weasyprint.HTML(string=html_content).write_pdf()
    # Provide the PDF file for download
    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=recorded_interactions.pdf'
    return response

"""
Tasks
"""
@app.route('/update_status', methods=['POST'])
def update_status():
    try:
        global stepNumber
        person = request.form.get('person')
        status = request.form.get('status')
        if person in tasks[stepNumber]:
            tasks[stepNumber][person]['status'] = status
            stepNumber += 1
            if stepNumber <= len(tasks):
                print(stepNumber)
                newStep = tasks[stepNumber][person]['task']
                newTime = tasks[stepNumber][person]['timer'] 
                newStatus = tasks[stepNumber][person]['status'] 
                return jsonify({'success': True, 'updatedStatus': status, 'newStep':newStep, 'newTime': newTime, 'newStatus': newStatus})
            else:
                return jsonify({'success': True, 'updatedStatus': status, 'newStep':'End', 'newTime':100, 'newStatus': 'End'})
        else:
            return jsonify({'success': False, 'message': 'Person not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

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
    socketio.run(app)
