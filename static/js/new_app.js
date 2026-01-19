$(document).ready(function () {
    let currentScenario = window.currentScenario || 0;
    let taskTimers = {};
    let startTime;
    let elapsedTimer;
    let sensorPollInterval;

    window.lastPeriodicAnswers = { pulse: null, rhythm: null };

    $('#startCode').on('click', function () {
        showQuestionPopup();
    });

    $('#inventoryButton').on('click', function () {
        window.location.href = '/inventory';
    });

    function isOnStartPage() {
        return window.location.pathname === "/" || window.location.pathname === "/index";
    }

    function showQuestionPopup() {
        let container = document.getElementById('questions-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'questions-container';
            document.body.appendChild(container);
        }
        container.innerHTML = `
            <div class="question" id="pulse-question">
                <h3>Pulse?</h3>
                    <div class="button-group">
                        <button class="answer-button" onclick="handlePeriodicAnswer('pulse', true)">Yes</button>
                        <button class="answer-button" onclick="handlePeriodicAnswer('pulse', false)">No</button>
                    </div>
            </div>
            <div class="divider"></div>
            <div class="question" id="rhythm-question">
                <h3>Shockable Rhythm?</h3>
                    <div class="button-group">
                        <button class="answer-button" onclick="handlePeriodicAnswer('rhythm', true)">Yes</button>
                        <button class="answer-button" onclick="handlePeriodicAnswer('rhythm', false)">No</button>
                    </div>
            </div>
        `;
        window.periodicAnswers = {};
    }

    window.handlePeriodicAnswer = function (type, value) {
        if (!window.periodicAnswers) window.periodicAnswers = {};
        window.periodicAnswers[type] = value;

        const buttons = document.getElementById(`${type}-question`).getElementsByTagName('button');
        Array.from(buttons).forEach(btn => {
            btn.disabled = true;
            if (btn.textContent.toLowerCase() === (value ? 'yes' : 'no')) {
                btn.style.backgroundColor = '#BAABC4';
            } else {
                btn.style.opacity = 0.5;
            }
        });

        // When both questions answered
        if (window.periodicAnswers.pulse !== undefined && window.periodicAnswers.rhythm !== undefined) {
            const changed = window.lastPeriodicAnswers.pulse !== window.periodicAnswers.pulse ||
                window.lastPeriodicAnswers.rhythm !== window.periodicAnswers.rhythm;

            // Update last answers
            window.lastPeriodicAnswers.pulse = window.periodicAnswers.pulse;
            window.lastPeriodicAnswers.rhythm = window.periodicAnswers.rhythm;

            // Determine scenario
            let scenario;
            if (!window.periodicAnswers.pulse && !window.periodicAnswers.rhythm) scenario = 0;
            else if (!window.periodicAnswers.pulse && window.periodicAnswers.rhythm) scenario = 1;
            else if (window.periodicAnswers.pulse && !window.periodicAnswers.rhythm) scenario = 2;
            else if (window.periodicAnswers.pulse && window.periodicAnswers.rhythm) {
                return
            }


            if (changed) {
                // Reload page if answer changed
                setTimeout(() => {
                    window.location.href = `/start_code?scenario=${scenario}`;
                }, 500);
            } else {
                // Keep page as is, remove popup
                const container = document.getElementById('questions-container');
                if (container) container.remove();
            }
        }
    };

    setInterval(() => {
        showQuestionPopup();
    }, 2 * 60 * 1000); // 2 minutes

    function initializePage() {
        console.log('Initializing page with scenario:', currentScenario);

        // Button click handlers
        document.querySelectorAll('.task-item').forEach(task => {
            task.addEventListener('click', function () {
                toggleTaskCompletion(this);
            });
        });

        applyTaskColors();
        startTaskTimers();
        updateCPRStatus();
        startElapsedTimer();

        // Start polling sensor status for Asystole scenario
        if (currentScenario === 0) {
            startSensorPolling();
        }
    }

    function startSensorPolling() {
        // Clear existing interval
        if (sensorPollInterval) {
            clearInterval(sensorPollInterval);
        }

        // Poll sensor status every second
        sensorPollInterval = setInterval(pollSensorStatus, 1000);
    }

    function pollSensorStatus() {
        if (currentScenario !== 0) return; // Only for Asystole
        console.log("🔍 Polling sensor status...");

        $.ajax({
            url: '/check_tasks_from_sensors',
            type: 'GET',
            success: function (response) {
                console.log("📡 Sensor response:", response);

                if (response.success && response.updated_tasks && response.updated_tasks.length > 0) {
                    console.log(`✅ Found ${response.updated_tasks.length} tasks to update:`, response.updated_tasks);
                    response.updated_tasks.forEach(updatedTask => {
                        console.log(`Processing: ${updatedTask.category} - ${updatedTask.task}`);
                        updateCheckboxFromSensor(updatedTask.category, updatedTask.task);
                    });
                } else {
                    console.log("⚠ No tasks to update");
                }

                if (response.sensor_states) {
                    console.log("📊 Sensor states:", response.sensor_states);
                    updateSensorUI(response.sensor_states);
                }
            },
            error: function (error) {
                console.error('❌ Failed to poll sensor status:', error);
            }
        });
    }

    function updateCheckboxFromSensor(category, taskName) {
        // Find the task element and mark it as completed
        const taskContainers = {
            'Medications': 'medications-tasks',
            'Compressions': 'compressions-tasks',
            'Airways': 'airways-tasks'
        };

        const containerId = taskContainers[category];
        if (!containerId) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const taskItems = container.getElementsByClassName('task-item');
        for (let taskItem of taskItems) {
            const taskText = taskItem.textContent.replace('✓', '').trim();
            if (taskText === taskName) {
                const checkbox = taskItem.querySelector('.checkbox');
                if (!checkbox.classList.contains('checked')) {
                    checkbox.classList.add('checked');
                    checkbox.innerHTML = '✓';
                    taskItem.classList.add('completed');

                    // Also record the task completion
                    recordTaskCompletion(category, taskName);

                    console.log(`Auto-checked ${taskName} from sensor`);
                }
                break;
            }
        }
    }

    function updateSensorUI(sensorStates) {
        // You can add visual feedback for sensor states if needed
        // For example, change border colors or add icons
        const ivTask = findTaskElement('Place IV #1');
        const oxygenTask = findTaskElement('Place Oxygen');

        if (ivTask) {
            ivTask.style.border = sensorStates.iv_removed ? '2px solid green' : '2px solid red';
        }

        if (oxygenTask) {
            oxygenTask.style.border = sensorStates.oxygen_removed ? '2px solid green' : '2px solid red';
        }

        // Check if both are removed (red light should be off)
        if (sensorStates.iv_removed && sensorStates.oxygen_removed) {
            console.log("Both IV and Oxygen removed - red light should be OFF");
        }
    }

    function findTaskElement(taskName) {
        const allTasks = document.querySelectorAll('.task-item');
        for (let task of allTasks) {
            if (task.textContent.replace('✓', '').trim() === taskName) {
                return task;
            }
        }
        return null;
    }

    function updateCPRStatus() {
        const cprStatus = document.getElementById('cpr-status');
        const cprValue = document.getElementById('cpr-value');

        // If on index page
        if (!cprStatus || !cprValue) {
            return;
        }

        const pulseDisplay = document.getElementById('pulse-display');
        const rhythmDisplay = document.getElementById('rhythm-display');

        if (pulseDisplay) {
            const hasPulse = pulseDisplay.textContent.trim().toLowerCase() === 'yes';
            const cprRequired = !hasPulse;
            updateCPRDisplay(cprStatus, cprValue, cprRequired);
        }
    }


    function updateCPRDisplay(cprStatus, cprValue, cprRequired) {
        if (cprRequired) {
            cprStatus.className = 'cpr-status active';
            cprValue.textContent = 'YES';
            cprValue.style.color = 'white';
        } else {
            cprStatus.className = 'cpr-status inactive';
            cprValue.textContent = 'NO';
            cprValue.style.color = '#666666';
        }
    }

    function toggleTaskCompletion(taskElement) {
        const checkbox = taskElement.querySelector('.checkbox');
        const isCompleted = checkbox.classList.contains('checked');

        if (!isCompleted) {
            // Mark as completed
            checkbox.classList.add('checked');
            checkbox.innerHTML = '✓';
            taskElement.classList.add('completed');

            // Record completion
            const category = getTaskCategory(taskElement);
            const taskText = taskElement.textContent.replace('✓', '').trim();
            recordTaskCompletion(category, taskText);
        }
    }

    function getTaskCategory(taskElement) {
        const container = taskElement.closest('.task-container');
        if (container.id.includes('medications')) return 'Medications';
        if (container.id.includes('compressions')) return 'Compressions';
        if (container.id.includes('airways')) return 'Airways';
        return 'Unknown';
    }

    function recordTaskCompletion(category, task) {
        const elapsedTime = getElapsedTime();
        console.log(`Task completed: ${task} in ${category} at ${elapsedTime}s`);
        // Send to server
        $.ajax({
            url: '/record_task_completion',
            type: 'POST',
            data: {
                scenario: currentScenario,
                category: category,
                task: task,
                action: 'complete',
                elapsed_time: elapsedTime
            },
            success: function (response) {
                console.log('Task completion recorded:', response);
            },
            error: function (error) {
                console.error('Failed to record task completion:', error);
            }
        });
    }


    function startTaskTimers() {
        // Clear existing timers
        Object.values(taskTimers).forEach(timer => clearTimeout(timer));
        taskTimers = {};

        // Start timers for tasks that should auto-complete
        // document.querySelectorAll('.task-item').forEach(task => {
        //     const stepTime = parseInt(task.dataset.step) || 20;
        //     const taskId = `${getTaskCategory(task)}-${task.textContent.trim()}`;

        //     // Auto-complete after the specified time
        //     taskTimers[taskId] = setTimeout(() => {
        //         if (!task.querySelector('.checkbox').classList.contains('checked')) {
        //             toggleTaskCompletion(task);
        //             console.log(`Auto-completed task: ${task.textContent.trim()}`);
        //         }
        //     }, stepTime * 1000);
        // });
    }

    function getTaskColor(taskName) {
        const name = taskName.toLowerCase();

        if (name.includes('bicarbonate')) return '#D27B7B'; // Red
        if (name.includes('epi')) return '#AED27B'; // Green
        if (name.includes('amiodarone')) return '#7BCED2'; // Blue
        if (name.includes('iv') || name.includes('oxygen')) return '#FFE57D'; // Yellow

        // Default gray
        return '#D9D9D9';
    }

    function applyTaskColors() {
        document.querySelectorAll('.task-item').forEach(item => {
            const text = item.textContent.replace('✓', '').trim();
            item.style.backgroundColor = getTaskColor(text);
        });
    }


    function startElapsedTimer() {
        // Clear existing timer
        if (elapsedTimer) {
            clearInterval(elapsedTimer);
        }

        // Set start time
        startTime = Date.now();

        // Create or update timer display
        let timerDisplay = document.getElementById('elapsed-timer');

        // Update timer every second
        elapsedTimer = setInterval(() => {
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsedTime / 60);
            const seconds = elapsedTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    function stopElapsedTimer() {
        if (elapsedTimer) {
            clearInterval(elapsedTimer);
            elapsedTimer = null;
        }
    }

    function getElapsedTime() {
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime) / 1000);
    }

    // Handle scenario changes from questions
    window.handleScenarioChange = function (newScenario) {
        console.log('Changing to scenario:', newScenario);
        currentScenario = newScenario;

        // Reload the page with the new scenario
        window.location.href = `/start_code?scenario=${newScenario}`;
    };
    initializePage();
});