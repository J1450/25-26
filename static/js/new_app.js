$(document).ready(function () {
    let currentScenario = window.currentScenario || 0;
    let taskTimers = {};

    initializePage();

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
        console.log(`Task completed: ${task} in ${category}`);

        // Send to server
        $.ajax({
            url: '/record_task_completion',
            type: 'POST',
            data: {
                scenario: currentScenario,
                category: category,
                task: task,
                action: 'complete'
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

    // Handle scenario changes from questions
    window.handleScenarioChange = function (newScenario) {
        console.log('Changing to scenario:', newScenario);
        currentScenario = newScenario;

        // Reload the page with the new scenario
        window.location.href = `/start_code?scenario=${newScenario}`;
    };

    // Global function to handle initial answers (for the start page)
    window.handleInitialAnswer = function (type, value) {
        if (!window.initialAnswers) window.initialAnswers = {};
        window.initialAnswers[type] = value;

        const questionDiv = document.getElementById(`${type}-question`);
        if (questionDiv) {
            const buttons = questionDiv.getElementsByTagName('button');
            Array.from(buttons).forEach(button => {
                button.disabled = true;
                if (button.textContent.toLowerCase() === (value ? 'yes' : 'no')) {
                    button.style.backgroundColor = '#28a745';
                } else {
                    button.style.opacity = '0.5';
                }
            });
        }

        // Check if both questions are answered
        if (window.initialAnswers.pulse !== undefined && window.initialAnswers.rhythm !== undefined) {
            // Determine scenario
            let scenario;
            if (!window.initialAnswers.pulse && !window.initialAnswers.rhythm) {
                scenario = 0; // Asystole
            } else if (!window.initialAnswers.pulse && window.initialAnswers.rhythm) {
                scenario = 1; // Ventricular Fibrillation
            } else if (window.initialAnswers.pulse && !window.initialAnswers.rhythm) {
                scenario = 2; // Normal Sinus
            }

            // Redirect to the selected scenario
            setTimeout(() => {
                window.location.href = `/start_code?scenario=${scenario}`;
            }, 1000);
        }
    };
});