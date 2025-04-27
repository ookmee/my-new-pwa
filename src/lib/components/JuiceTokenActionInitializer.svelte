<!-- src/lib/components/JuiceTokenActionInitializer.svelte
 * Component for initializing a Ɉ token action using the back camera
 * UI only - delegates token logic to TokenEngine (Rust/WASM)
 */
-->
<script>
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import jsQR from 'jsqr';
    
    // Event dispatcher for communicating with parent component
    const dispatch = createEventDispatcher();
    
    // Props - assume token engine will handle all token logic
    export let tokenAction = {
        id: 'Ɉ' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        type: 'transaction', // transaction, escrow, bet, settlement
        amount: '',
        details: '',
        counterpartyId: '',
        timestamp: Date.now(),
        expiresAt: null,
        role: Math.random() < 0.5 ? 'A' : 'B' // Randomly assign role to ensure variation
    };
    
    // Camera state
    let videoElement;
    let canvasElement;
    let canvasContext;
    let stream = null;
    let scanning = false;
    let animationFrameId = null;
    
    // Scan state
    let scannedData = null;
    let scanCount = 0;
    let message = 'Point camera at QR code';
    let scanStatus = 'waiting'; // waiting, scanning, success, error
    let detectionProgress = 0;
    let detectionTimeout = null;
    let detectionStartTime = 0;
    
    // UI state
    let showCameraSelector = false;
    let availableCameras = [];
    let selectedCameraId = null;
    let activeTab = 'scan'; // scan, new, details
    let showConfirmation = false;
    
    onMount(async () => {
        await listCameras();
        startCamera();
    });
    
    onDestroy(() => {
        stopCamera();
        stopScanning();
        if (detectionTimeout) {
            clearTimeout(detectionTimeout);
        }
    });
    
    // List available cameras
    async function listCameras() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                console.log("enumerateDevices() not supported.");
                return;
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            availableCameras = devices
                .filter(device => device.kind === 'videoinput')
                .map((device, index) => {
                    return {
                        id: device.deviceId,
                        label: device.label || `Camera ${index + 1}`
                    };
                });
            
            // If back camera exists, select it by default
            const backCamera = availableCameras.find(camera => 
                camera.label.toLowerCase().includes('back') || 
                camera.label.toLowerCase().includes('rear') ||
                camera.label.toLowerCase().includes('environment')
            );
            
            if (backCamera) {
                selectedCameraId = backCamera.id;
            } else if (availableCameras.length > 0) {
                // If no back camera found, select the last camera (often the back camera on mobile)
                selectedCameraId = availableCameras[availableCameras.length - 1].id;
            }
        } catch (err) {
            console.error("Error listing cameras:", err);
        }
    }
    
    // Start the camera with selected device or environment facing preference
    async function startCamera() {
        try {
            stopCamera(); // Stop any existing stream first
            
            const constraints = {
                video: selectedCameraId
                    ? { deviceId: { exact: selectedCameraId } }
                    : { facingMode: 'environment' } // Default to back camera if no specific camera selected
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (videoElement) {
                videoElement.srcObject = stream;
                
                videoElement.onloadedmetadata = () => {
                    videoElement.play().then(() => {
                        console.log("Camera started");
                        
                        if (canvasElement) {
                            canvasElement.width = videoElement.videoWidth;
                            canvasElement.height = videoElement.videoHeight;
                            canvasContext = canvasElement.getContext('2d');
                            
                            // Start scanning after camera is ready
                            startScanning();
                        }
                    }).catch(err => {
                        console.error("Error playing video:", err);
                        message = "Error starting camera: " + err.message;
                        scanStatus = 'error';
                    });
                };
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            message = "Error accessing camera: " + err.message;
            scanStatus = 'error';
        }
    }
    
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }
    
    function startScanning() {
        scanning = true;
        scanStatus = 'scanning';
        message = 'Scanning for QR code...';
        scan();
    }
    
    function stopScanning() {
        scanning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    
    function scan() {
        if (!videoElement || !canvasContext || !scanning) {
            animationFrameId = requestAnimationFrame(scan);
            return;
        }
        
        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            // Draw the video frame to the canvas
            canvasContext.drawImage(
                videoElement,
                0, 0,
                canvasElement.width, canvasElement.height
            );
            
            // Get image data from canvas
            const imageData = canvasContext.getImageData(
                0, 0,
                canvasElement.width, canvasElement.height
            );
            
            // Draw scan overlay
            drawScanOverlay();
            
            // Try to find QR code in the image
            try {
                const code = jsQR(
                    imageData.data,
                    imageData.width,
                    imageData.height,
                    { inversionAttempts: "dontInvert" }
                );
                
                if (code) {
                    // Found a QR code
                    scanCount++;
                    console.log("QR code detected:", code.data);
                    
                    // Draw QR position
                    if (code.location) {
                        drawQROutline(code.location);
                    }
                    
                    // Process the QR data with debounce
                    processScannedQR(code.data);
                    
                    // Haptic feedback
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                } else {
                    // Reset detection if QR lost
                    if (detectionStartTime !== 0) {
                        detectionStartTime = 0;
                        detectionProgress = 0;
                        if (detectionTimeout) {
                            clearTimeout(detectionTimeout);
                            detectionTimeout = null;
                        }
                    }
                }
            } catch (err) {
                console.error("Error scanning QR:", err);
            }
        }
        
        // Continue scanning
        animationFrameId = requestAnimationFrame(scan);
    }
    
    function drawScanOverlay() {
        // Draw a semi-transparent overlay
        canvasContext.fillStyle = 'rgba(0, 0, 0, 0.3)';
        canvasContext.fillRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Draw a clear scanning area in the center
        const size = Math.min(canvasElement.width, canvasElement.height) * 0.7;
        const centerX = canvasElement.width / 2;
        const centerY = canvasElement.height / 2;
        
        // Clear the center rectangle
        canvasContext.clearRect(
            centerX - size/2,
            centerY - size/2,
            size,
            size
        );
        
        // Draw the scanning frame
        canvasContext.strokeStyle = '#ffffff';
        canvasContext.lineWidth = 2;
        canvasContext.strokeRect(
            centerX - size/2,
            centerY - size/2,
            size,
            size
        );
        
        // Draw corner markers
        canvasContext.strokeStyle = '#4CAF50';
        canvasContext.lineWidth = 4;
        const cornerSize = 20;
        
        // Top-left corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX - size/2, centerY - size/2 + cornerSize);
        canvasContext.lineTo(centerX - size/2, centerY - size/2);
        canvasContext.lineTo(centerX - size/2 + cornerSize, centerY - size/2);
        canvasContext.stroke();
        
        // Top-right corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX + size/2 - cornerSize, centerY - size/2);
        canvasContext.lineTo(centerX + size/2, centerY - size/2);
        canvasContext.lineTo(centerX + size/2, centerY - size/2 + cornerSize);
        canvasContext.stroke();
        
        // Bottom-right corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX + size/2, centerY + size/2 - cornerSize);
        canvasContext.lineTo(centerX + size/2, centerY + size/2);
        canvasContext.lineTo(centerX + size/2 - cornerSize, centerY + size/2);
        canvasContext.stroke();
        
        // Bottom-left corner
        canvasContext.beginPath();
        canvasContext.moveTo(centerX - size/2 + cornerSize, centerY + size/2);
        canvasContext.lineTo(centerX - size/2, centerY + size/2);
        canvasContext.lineTo(centerX - size/2, centerY + size/2 - cornerSize);
        canvasContext.stroke();
        
        // Draw progress indicator if active detection
        if (detectionProgress > 0) {
            const progressBarWidth = size;
            const progressBarHeight = 6;
            
            // Background
            canvasContext.fillStyle = 'rgba(255, 255, 255, 0.3)';
            canvasContext.fillRect(
                centerX - size/2,
                centerY + size/2 + 20,
                progressBarWidth,
                progressBarHeight
            );
            
            // Filled part
            canvasContext.fillStyle = '#4CAF50';
            canvasContext.fillRect(
                centerX - size/2,
                centerY + size/2 + 20,
                progressBarWidth * (detectionProgress / 100),
                progressBarHeight
            );
        }
    }
    
    function drawQROutline(location) {
        canvasContext.strokeStyle = '#FF3B58';
        canvasContext.lineWidth = 5;
        
        canvasContext.beginPath();
        canvasContext.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
        canvasContext.lineTo(location.topRightCorner.x, location.topRightCorner.y);
        canvasContext.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
        canvasContext.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
        canvasContext.lineTo(location.topLeftCorner.x, location.topLeftCorner.y);
        canvasContext.stroke();
    }
    
    function processScannedQR(data) {
        // Start detection sequence if new QR found
        if (detectionStartTime === 0) {
            detectionStartTime = Date.now();
            message = 'Hold steady while analyzing...';
            
            // Cancel any existing timeout
            if (detectionTimeout) {
                clearTimeout(detectionTimeout);
            }
            
            // Set new verification timeout (1.5 seconds of continuous detection)
            detectionTimeout = setTimeout(() => {
                verifyScannedQR(data);
            }, 1500);
        }
        
        // Update progress based on elapsed time
        const elapsed = Date.now() - detectionStartTime;
        detectionProgress = Math.min(100, Math.floor((elapsed / 1500) * 100));
    }
    
    function verifyScannedQR(data) {
        try {
            // This would normally call TokenEngine to parse/validate the QR data
            // For now, we'll just simulate a successful scan
            
            let parsedData;
            
            // Simple parsing for demo purposes
            if (data.startsWith('{') && data.endsWith('}')) {
                parsedData = JSON.parse(data);
            } else if (data.startsWith('Ɉ:')) {
                // Very simplified parser
                const parts = data.split(':');
                if (parts.length >= 3) {
                    parsedData = {
                        id: parts[1] || tokenAction.id,
                        type: parts[2] || 'transaction'
                    };
                }
            } else {
                parsedData = { id: 'Ɉ' + data, type: 'unknown' };
            }
            
            // Update the token action with the parsed data
            scannedData = parsedData;
            tokenAction = { ...tokenAction, ...parsedData };
            
            scanStatus = 'success';
            message = 'Token action identified!';
            detectionProgress = 100;
            
            // Success feedback
            if (navigator.vibrate) {
                navigator.vibrate([50, 100, 150]);
            }
            
            // Show confirmation
            showConfirmation = true;
            
            // Pause scanning
            stopScanning();
            
        } catch (error) {
            console.error("Error parsing QR data:", error);
            scanStatus = 'error';
            message = 'Invalid QR code format';
            detectionProgress = 0;
            detectionStartTime = 0;
        }
    }
    
    function switchCamera() {
        if (availableCameras.length <= 1) {
            return; // Only one camera, nothing to switch to
        }
        
        // Find the index of the current camera
        const currentIndex = availableCameras.findIndex(camera => camera.id === selectedCameraId);
        const nextIndex = (currentIndex + 1) % availableCameras.length;
        
        // Select the next camera
        selectedCameraId = availableCameras[nextIndex].id;
        
        // Restart the camera with the new selection
        startCamera();
    }
    
    function toggleCameraSelector() {
        showCameraSelector = !showCameraSelector;
    }
    
    function selectCamera(cameraId) {
        selectedCameraId = cameraId;
        showCameraSelector = false;
        startCamera();
    }
    
    function switchTab(tab) {
        activeTab = tab;
        
        // If switching to scan tab, restart scanning
        if (tab === 'scan' && !scanning) {
            startScanning();
        } else if (tab !== 'scan' && scanning) {
            stopScanning();
        }
    }
    
    function createNewAction() {
        // Generate a new action ID
        tokenAction.id = 'Ɉ' + Math.random().toString(36).substring(2, 8).toUpperCase();
        tokenAction.timestamp = Date.now();
        
        // Show confirmation
        showConfirmation = true;
    }
    
    function confirmAction() {
        // In a real implementation, this would call TokenEngine to finalize
        // the action creation before dispatching
        
        // Dispatch the action to the parent component
        dispatch('initialized', {
            action: { ...tokenAction }
        });
    }
    
    function cancelConfirmation() {
        showConfirmation = false;
        
        // If we were in scan mode, resume scanning
        if (activeTab === 'scan') {
            startScanning();
        }
    }
    
    function getActionTypeLabel(type) {
        switch (type) {
            case 'transaction': return 'Transaction';
            case 'escrow': return 'Escrow';
            case 'bet': return 'Bet';
            case 'settlement': return 'Settlement';
            default: return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown';
        }
    }
</script>

<div class="juice-tokenaction-initializer">
    <div class="header">
        <h2 class="title">Initialize Ɉ Token Action</h2>
    </div>

    <div class="tabs">
        <button 
            class="tab-button {activeTab === 'scan' ? 'active' : ''}" 
            on:click={() => switchTab('scan')}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            Scan QR
        </button>
        <button 
            class="tab-button {activeTab === 'new' ? 'active' : ''}" 
            on:click={() => switchTab('new')}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            New Action
        </button>
        <button 
            class="tab-button {activeTab === 'details' ? 'active' : ''}" 
            on:click={() => switchTab('details')}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Details
        </button>
    </div>
    
    <div class="tab-content">
        {#if activeTab === 'scan'}
            <!-- Scan QR Tab -->
            <div class="scan-container">
                <!-- Camera controls -->
                <div class="camera-controls">
                    <button class="camera-button" on:click={switchCamera}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                        Switch Camera
                    </button>
                    <button class="camera-button" on:click={toggleCameraSelector}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        Camera Options
                    </button>
                </div>
                
                <!-- Camera selector dropdown -->
                {#if showCameraSelector && availableCameras.length > 0}
                    <div class="camera-selector">
                        <div class="selector-title">Select Camera</div>
                        <div class="camera-list">
                            {#each availableCameras as camera}
                                <button 
                                    class="camera-option {selectedCameraId === camera.id ? 'selected' : ''}" 
                                    on:click={() => selectCamera(camera.id)}
                                >
                                    {camera.label}
                                    {#if selectedCameraId === camera.id}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
                
                <!-- Camera view with full width/height -->
                <div class="camera-view">
                    <video 
                        bind:this={videoElement} 
                        autoplay 
                        playsinline 
                        muted
                    ></video>
                    <canvas bind:this={canvasElement}></canvas>
                    
                    <!-- Scan status overlay -->
                    <div class="scan-status {scanStatus}">
                        <div class="status-message">{message}</div>
                        {#if scanStatus === 'scanning' && detectionProgress > 0}
                            <div class="progress-text">{detectionProgress}%</div>
                        {/if}
                    </div>
                </div>
                
                <!-- Instructions -->
                <div class="scan-instructions">
                    <p>Point your camera at a Ɉ token action QR code to scan details.</p>
                    <p>Hold steady for a complete scan.</p>
                </div>
            </div>
            
        {:else if activeTab === 'new'}
            <!-- New Action Tab -->
            <div class="new-action-container">
                <h3>Create New Ɉ Token Action</h3>
                
                <div class="action-form">
                    <div class="form-group">
                        <label for="action-type">Action Type</label>
                        <select id="action-type" bind:value={tokenAction.type} class="form-input">
                            <option value="transaction">Transaction</option>
                            <option value="escrow">Escrow</option>
                            <option value="bet">Bet</option>
                            <option value="settlement">Settlement</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="action-amount">Amount (Ɉ)</label>
                        <div class="amount-input-group">
                            <input 
                                type="number" 
                                id="action-amount" 
                                bind:value={tokenAction.amount} 
                                placeholder="0.00" 
                                step="0.01"
                                class="form-input"
                            />
                            <div class="currency-symbol">Ɉ</div>
                        </div>
                        <div class="amount-hint">
                            <small>Token engine will handle the distribution of tokens</small>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="action-counterparty">Counterparty ID (Optional)</label>
                        <input 
                            type="text" 
                            id="action-counterparty" 
                            bind:value={tokenAction.counterpartyId} 
                            placeholder="Leave blank to assign during finalization" 
                            class="form-input"
                        />
                    </div>
                    
                    <div class="form-group">
                        <label for="action-details">Details</label>
                        <textarea 
                            id="action-details" 
                            bind:value={tokenAction.details} 
                            placeholder="Enter any additional details about this token action" 
                            class="form-input textarea"
                        ></textarea>
                    </div>
                    
                    {#if tokenAction.type === 'escrow' || tokenAction.type === 'bet'}
                        <div class="form-group">
                            <label for="expiry-date">Expiry Date (Optional)</label>
                            <input 
                                type="datetime-local" 
                                id="expiry-date" 
                                bind:value={tokenAction.expiresAt} 
                                class="form-input"
                            />
                        </div>
                    {/if}
                    
                    <div class="form-note">
                        <p>Note: This will be processed as two escrows requiring finalization.</p>
                        <p>Binary token distribution will be handled by the token engine.</p>
                    </div>
                    
                    <button class="create-button" on:click={createNewAction}>
                        Create Token Action
                    </button>
                </div>
            </div>
            
        {:else if activeTab === 'details'}
            <!-- Details Tab -->
            <div class="details-container">
                <h3>Ɉ Token Action Details</h3>
                
                {#if tokenAction.id}
                    <div class="details-card">
                        <div class="detail-row">
                            <span class="detail-label">ID:</span>
                            <span class="detail-value">{tokenAction.id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">{getActionTypeLabel(tokenAction.type)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Role:</span>
                            <span class="detail-value">{tokenAction.role === 'A' ? 'Triangle (A)' : 'Circle (B)'}</span>
                        </div>
                        {#if tokenAction.amount}
                            <div class="detail-row">
                                <span class="detail-label">Amount:</span>
                                <span class="detail-value">Ɉ {tokenAction.amount}</span>
                            </div>
                        {/if}
                        {#if tokenAction.counterpartyId}
                            <div class="detail-row">
                                <span class="detail-label">Counterparty:</span>
                                <span class="detail-value">{tokenAction.counterpartyId}</span>
                            </div>
                        {/if}
                        {#if tokenAction.details}
                            <div class="detail-row">
                                <span class="detail-label">Details:</span>
                                <span class="detail-value">{tokenAction.details}</span>
                            </div>
                        {/if}
                        {#if tokenAction.expiresAt}
                            <div class="detail-row">
                                <span class="detail-label">Expires:</span>
                                <span class="detail-value">{new Date(tokenAction.expiresAt).toLocaleString()}</span>
                            </div>
                        {/if}
                        <div class="detail-row">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">{new Date(tokenAction.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="token-note">
                        <p>Token distribution will be handled by the token engine (Rust/WASM).</p>
                        <p>Binary denominations (1, 2, 4, 8, 16, etc.) will be used with appropriate buffer.</p>
                    </div>
                    
                    <button class="proceed-button" on:click={() => showConfirmation = true}>
                        Proceed to Finalization
                    </button>
                {:else}
                    <div class="no-details">
                        <p>No token action has been initialized yet.</p>
                        <p>Scan a QR code or create a new action to continue.</p>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
    
    <!-- Confirmation Modal -->
    {#if showConfirmation}
        <div class="modal-overlay" on:click={cancelConfirmation}>
            <div class="modal-content" on:click|stopPropagation>
                <h3>Confirm Ɉ Token Action</h3>
                
                <div class="confirmation-details">
                    <div class="conf-row">
                        <span class="conf-label">Type:</span>
                        <span class="conf-value">{getActionTypeLabel(tokenAction.type)}</span>
                    </div>
                    {#if tokenAction.amount}
                        <div class="conf-row">
                            <span class="conf-label">Amount:</span>
                            <span class="conf-value">Ɉ {tokenAction.amount}</span>
                        </div>
                    {/if}
                    {#if tokenAction.counterpartyId}
                        <div class="conf-row">
                            <span class="conf-label">Counterparty:</span>
                            <span class="conf-value">{tokenAction.counterpartyId}</span>
                        </div>
                    {/if}
                    <div class="conf-row">
                        <span class="conf-label">Role:</span>
                        <span class="conf-value">{tokenAction.role === 'A' ? 'Triangle (A)' : 'Circle (B)'}</span>
                    </div>
                    <div class="conf-row">
                        <span class="conf-label">ID:</span>
                        <span class="conf-value">{tokenAction.id}</span>
                    </div>
                </div>
                
                <div class="token-processing-note">
                    <p>Token distribution will be processed by the token engine.</p>
                </div>
                
                <div class="modal-buttons">
                    <button class="modal-button cancel" on:click={cancelConfirmation}>
                        Cancel
                    </button>
                    <button class="modal-button confirm" on:click={confirmAction}>
                        Proceed to Finalization
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .juice-tokenaction-initializer {
        width: 100%;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position: relative;
    }
    
    .header {
        margin-bottom: 15px;
        text-align: center;
    }
    
    .title {
        margin: 0;
        font-size: 24px;
        color: #2c5282;
        font-weight: 600;
    }
    
    /* Tabs */
    .tabs {
        display: flex;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 15px;
    }
    
    .tab-button {
        flex: 1;
        padding: 10px;
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #4a5568;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .tab-button:hover {
        color: #2b6cb0;
    }
    
    .tab-button.active {
        color: #2b6cb0;
        border-bottom-color: #3182ce;
    }
    
    /* Camera scanning tab */
    .scan-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .camera-controls {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
    }
    
    .camera-button {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 8px 12px;
        background-color: #f7fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        color: #4a5568;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .camera-button:hover {
        background-color: #edf2f7;
    }
    
    .camera-selector {
        background-color: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 12px;
        margin-bottom: 15px;
    }
    
    .selector-title {
        font-weight: 600;
        color: #2d3748;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #edf2f7;
    }
    
    .camera-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .camera-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background-color: #f7fafc;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        color: #4a5568;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .camera-option:hover {
        background-color: #edf2f7;
    }
    
    .camera-option.selected {
        background-color: #ebf8ff;
        border-color: #90cdf4;
        color: #2b6cb0;
    }
    
    .camera-view {
        position: relative;
        width: 100%;
        height: 0;
        padding-bottom: 75%; /* 4:3 Aspect ratio */
        background-color: #000;
        border-radius: 8px;
        overflow: hidden;
    }
    
    .camera-view video,
    .camera-view canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .scan-status {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 200px;
        text-align: center;
    }
    
    .scan-status.success {
        background-color: rgba(39, 174, 96, 0.8);
    }
    
    .scan-status.error {
        background-color: rgba(231, 76, 60, 0.8);
    }
    
    .progress-text {
        font-size: 12px;
        opacity: 0.9;
        margin-top: 4px;
    }
    
    .scan-instructions {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px;
    }
    
    .scan-instructions p {
        margin: 5px 0;
        font-size: 14px;
        color: #4a5568;
    }
    
    /* New Action Tab */
    .new-action-container {
        padding: 10px 0;
    }
    
    .new-action-container h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #2d3748;
        font-size: 18px;
    }
    
    .action-form {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    label {
        font-size: 14px;
        font-weight: 500;
        color: #4a5568;
    }
    
    .form-input {
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 16px;
        color: #2d3748;
        transition: border-color 0.2s ease;
    }
    
    .form-input:focus {
        border-color: #3182ce;
        outline: none;
    }
    
    .form-input.textarea {
        min-height: 80px;
        resize: vertical;
    }
    
    .amount-input-group {
        display: flex;
        align-items: center;
    }
    
    .amount-input-group .form-input {
        flex: 1;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }
    
    .currency-symbol {
        width: 40px;
        padding: 10px 12px;
        background-color: #f7fafc;
        border: 1px solid #e2e8f0;
        border-left: none;
        border-top-right-radius: 6px;
        border-bottom-right-radius: 6px;
        font-size: 16px;
        color: #2d3748;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .amount-hint {
        font-size: 12px;
        color: #718096;
        margin-top: 4px;
    }
    
    .form-note {
        background-color: #edf2f7;
        padding: 10px;
        border-radius: 6px;
        font-size: 14px;
        color: #4a5568;
    }
    
    .form-note p {
        margin: 5px 0;
    }
    
    .create-button {
        padding: 12px;
        background-color: #3182ce;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
        margin-top: 10px;
    }
    
    .create-button:hover {
        background-color: #2b6cb0;
    }
    
    /* Details Tab */
    .details-container {
        padding: 10px 0;
    }
    
    .details-container h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #2d3748;
        font-size: 18px;
    }
    
    .details-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
    }
    
    .detail-row {
        display: flex;
        margin-bottom: 10px;
        border-bottom: 1px solid #edf2f7;
        padding-bottom: 10px;
    }
    
    .detail-row:last-child {
        margin-bottom: 0;
        border-bottom: none;
        padding-bottom: 0;
    }
    
    .detail-label {
        width: 120px;
        font-weight: 600;
        color: #4a5568;
    }
    
    .detail-value {
        flex: 1;
        color: #2d3748;
        word-break: break-all;
    }
    
    .token-note {
        background-color: #edf2f7;
        padding: 10px;
        border-radius: 6px;
        font-size: 14px;
        color: #4a5568;
        margin-bottom: 20px;
    }
    
    .token-note p {
        margin: 5px 0;
    }
    
    .proceed-button {
        padding: 12px;
        background-color: #38a169;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
        width: 100%;
    }
    
    .proceed-button:hover {
        background-color: #2f855a;
    }
    
    .no-details {
        text-align: center;
        padding: 30px 0;
        color: #718096;
    }
    
    /* Confirmation Modal */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-content {
        background-color: white;
        border-radius: 8px;
        padding: 20px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
    }
    
    .modal-content h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #2d3748;
        font-size: 18px;
        text-align: center;
    }
    
    .confirmation-details {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 15px;
    }
    
    .conf-row {
        display: flex;
        margin-bottom: 8px;
    }
    
    .conf-row:last-child {
        margin-bottom: 0;
    }
    
    .conf-label {
        width: 100px;
        font-weight: 600;
        color: #4a5568;
    }
    
    .conf-value {
        flex: 1;
        color: #2d3748;
    }
    
    .token-processing-note {
        background-color: #edf2f7;
        padding: 10px;
        border-radius: 6px;
        font-size: 14px;
        color: #4a5568;
        margin-bottom: 15px;
    }
    
    .token-processing-note p {
        margin: 5px 0;
    }
    
    .modal-buttons {
        display: flex;
        gap: 10px;
    }
    
    .modal-button {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }
    
    .modal-button.cancel {
        background-color: #e2e8f0;
        color: #4a5568;
    }
    
    .modal-button.cancel:hover {
        background-color: #cbd5e0;
    }
    
    .modal-button.confirm {
        background-color: #38a169;
        color: white;
    }
    
    .modal-button.confirm:hover {
        background-color: #2f855a;
    }
    
    /* Responsive adjustments */
    @media (max-width: 600px) {
        .camera-controls {
            flex-direction: column;
        }
        
        .detail-row, .conf-row {
            flex-direction: column;
        }
        
        .detail-label, .conf-label {
            width: 100%;
            margin-bottom: 4px;
        }
    }
</style>