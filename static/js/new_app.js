$(document).ready(function () {
    /*
        GLOBAL STATE
    */

    let currentScenario = window.currentScenario || 0;
    let taskTimers = {};
    let startTime;
    let elapsedTimer;
    let sensorPollInterval;

    // Track last pulse/rhythm values
    window.lastPeriodicAnswers = { pulse: null, rhythm: null };

    /*
        NAVIGATION / BUTTON HANDLERS
    */

    $('#startCode').on('click', function () {
        showQuestionPopup();
    });

    $('#inventoryButton').on('click', function () {
        window.location.href = '/inventory';
    });

    function isOnStartPage() {
        return window.location.pathname === "/" || window.location.pathname === "/index";
    }

    /* 
        UI HELPERS 
    */

    // Animate task out
    function floatOutAndRemoveTask(taskEl) {
        taskEl.classList.add("exit");
        taskEl.addEventListener(
            "transitionend",
            () => {
                taskEl.remove();
                checkAllTasksCompleted();
            },
            { once: true }
        );
    }

    /* 
        PULSE / RHYTHM POPUP
    */

    function showQuestionPopup() {
        let container = document.getElementById('questions-container');

        // Create container if doesn't exist
        if (!container) {
            container = document.createElement('div');
            container.id = 'questions-container';
            document.body.appendChild(container);
        }

        // Questions UI
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

    // Handle Yes/No answers
    window.handlePeriodicAnswer = function (type, value) {
        if (!window.periodicAnswers) window.periodicAnswers = {};
        window.periodicAnswers[type] = value;

        // Disable buttons after selection
        const buttons = document.getElementById(`${type}-question`).getElementsByTagName('button');
        Array.from(buttons).forEach(btn => {
            btn.disabled = true;
            if (btn.textContent.toLowerCase() === (value ? 'yes' : 'no')) {
                btn.style.backgroundColor = '#BAABC4';
            } else {
                btn.style.opacity = 0.5;
            }
        });

        // Wait until both questions answered
        if (window.periodicAnswers.pulse !== undefined && window.periodicAnswers.rhythm !== undefined) {

            const changed =
                window.lastPeriodicAnswers.pulse !== window.periodicAnswers.pulse ||
                window.lastPeriodicAnswers.rhythm !== window.periodicAnswers.rhythm;

            // Save latest answers
            window.lastPeriodicAnswers.pulse = window.periodicAnswers.pulse;
            window.lastPeriodicAnswers.rhythm = window.periodicAnswers.rhythm;

            // Determine scenario
            let scenario;
            if (!window.periodicAnswers.pulse && !window.periodicAnswers.rhythm) scenario = 0;
            else if (!window.periodicAnswers.pulse && window.periodicAnswers.rhythm) scenario = 1;
            else if (window.periodicAnswers.pulse && !window.periodicAnswers.rhythm) scenario = 2;
            else if (window.periodicAnswers.pulse && window.periodicAnswers.rhythm) {
                return // Pulse + shockable rhythm --> no scenario
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

    // Reprompt every 2 minutes
    setInterval(showQuestionPopup, 2 * 60 * 1000);

    /*
        PAGE INTIALIZATION
    */

    function initializePage() {
        console.log('Initializing page with scenario:', currentScenario);

        // Task click handlers
        document.querySelectorAll('.task-item').forEach(task => {
            task.addEventListener('click', function () {
                toggleTaskCompletion(this);
            });
        });

        applyTaskColors();
        startTaskTimers();
        updateCPRStatus();
        startElapsedTimer();

        // Start polling sensor status
        startSensorPolling();

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
        console.log('Polling sensors...');

        $.ajax({
            url: '/check_tasks_from_sensors',
            type: 'GET',
            success: function (response) {
                console.log('Sensor response received:', response);

                // Log what tasks we got back
                if (response.updated_tasks && response.updated_tasks.length) {
                    console.log(`Received ${response.updated_tasks.length} task updates from sensors:`);
                    response.updated_tasks.forEach(function (task, index) {
                        console.log(`   ${index + 1}. ${task.category} - "${task.task}"`);
                    });

                    response.updated_tasks.forEach(function (task) {
                        console.log(`Attempting to update: ${task.category} - "${task.task}"`);
                        updateCheckboxFromSensor(task.category, task.task);
                    });
                } else {
                    console.log('No task updates from sensors');
                }

                if (response.sensor_states) {
                    console.log('Sensor states:', response.sensor_states);
                    updateSensorUI(response.sensor_states);
                }
            },
            error: function (err) {
                console.error('Sensor polling failed:', err);
            }
        });
    }

    /*
        TASK UPDATES
    */
    function updateCheckboxFromSensor(category, taskName) {
        console.log(`Attempting to update ${category} - "${taskName}"`);

        const taskItems = document.querySelectorAll('.task-item');
        let found = false;

        taskItems.forEach(taskItem => {
            const taskText = taskItem.textContent.replace('✓', '').trim();

            // Simple direct comparison first
            if (taskText === taskName) {
                console.log(`✓ Exact match: "${taskText}"`);
                found = markTaskCompleted(taskItem, category, taskText);
            }
            // Then try contains matching for flexibility
            else if (taskText.includes(taskName) || taskName.includes(taskText)) {
                console.log(`✓ Partial match: "${taskText}" contains/in "${taskName}"`);
                found = markTaskCompleted(taskItem, category, taskText);
            }
            // Special cases
            else if (taskName === 'Place IV #1' && taskText.includes('IV')) {
                console.log(`✓ Special match: IV task`);
                found = markTaskCompleted(taskItem, category, taskText);
            }
            else if (taskName === 'Place Oxygen' && taskText.includes('Oxygen')) {
                console.log(`✓ Special match: Oxygen task`);
                found = markTaskCompleted(taskItem, category, taskText);
            }
        });

        if (!found) {
            console.log(`❌ No matching task found for "${taskName}"`);
            // Debug: list all available tasks
            console.log('Available tasks:', Array.from(taskItems).map(t => t.textContent.replace('✓', '').trim()));
        }
    }

    // Helper function to mark task as completed
    function markTaskCompleted(taskItem, category, taskText) {
        const checkbox = taskItem.querySelector('.checkbox');
        if (!checkbox.classList.contains('checked')) {
            checkbox.classList.add('checked');
            checkbox.innerHTML = '✓';
            taskItem.classList.add('completed');

            // Add visual feedback
            taskItem.style.backgroundColor = '#d4edda';
            taskItem.style.borderLeft = '5px solid #28a745';

            // Float out after a short delay
            setTimeout(() => {
                floatOutAndRemoveTask(taskItem);
            }, 500);

            recordTaskCompletion(category, taskText);
            return true;
        }
        return false;
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

            floatOutAndRemoveTask(taskElement);
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

    function getTaskCategory(taskElement) {
        const container = taskElement.closest('.task-container');
        if (container.id.includes('medications')) return 'Medications';
        if (container.id.includes('compressions')) return 'Compressions';
        if (container.id.includes('airways')) return 'Airways';
        return 'Unknown';
    }

    function updateSensorUI(sensorStates) {
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

    /*
        SERVER COMMUNICATION
    */

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
            }
        });
    }

    function checkAllTasksCompleted() {
        const remainingTasks = document.querySelectorAll('.task-item');
        if (remainingTasks.length === 0) {
            setTimeout(() => {
                window.location.href = '/download_page';
            }, 800);
        }
    }

    /* 
        TASK STYLING 
    */

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

    /* 
        CPR STATUS
    */

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

    /* 
        TIMER 
    */

    function startTaskTimers() {
        // Clear existing timers
        Object.values(taskTimers).forEach(timer => clearTimeout(timer));
        taskTimers = {};
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