$(document).ready(function () {
    let currentScenario = window.currentScenario || 0;
    let taskTimers = {};
    let startTime;
    let elapsedTimer;

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