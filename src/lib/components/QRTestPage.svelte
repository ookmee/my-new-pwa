<!-- QRTestPage.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    import QRCode from 'qrcode';
    
    let videoElement;
    let canvasElement;
    let canvasContext;
    let animationFrameId = null;
    let lastDetectedData = '';
    let detectionCount = 0;
    let generatedQRData = 'Test QR Code: ' + Math.random().toString(36).substring(2, 9);
    let qrImageSrc = '';
    let showGeneratedQR = false;
    let detectionLog = [];
    let maxLogEntries = 5;
    
    onMount(async () => {
      await generateQR();
      await startCamera();
      startScanning();
    });
    
    onDestroy(() => {
      stopScanning();
      stopCamera();
    });
    
    async function generateQR() {
      qrImageSrc = await QRCode.toDataURL(generatedQRData);
    }
    
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play();
          
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          canvasContext = canvasElement.getContext('2d');
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        addToLog('⚠️ Camera error: ' + error.message);
      }
    }
    
    function stopCamera() {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
    }
    
    function startScanning() {
      scan();
    }
    
    function stopScanning() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
    
    function scan() {
      if (!videoElement || !canvasContext) {
        animationFrameId = requestAnimationFrame(scan);
        return;
      }
      
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        // Draw video frame to canvas
        canvasContext.drawImage(
          videoElement, 
          0, 0, 
          canvasElement.width, 
          canvasElement.height
        );
        
        const imageData = canvasContext.getImageData(
          0, 0, 
          canvasElement.width, 
          canvasElement.height
        );
        
        // Attempt to detect QR code
        const code = jsQR(
          imageData.data, 
          imageData.width, 
          imageData.height, 
          {
            inversionAttempts: "dontInvert"
          }
        );
        
        if (code) {
          detectionCount++;
          
          if (lastDetectedData !== code.data) {
            lastDetectedData = code.data;
            addToLog('🔍 Detected: ' + truncateString(code.data, 30));
            
            // Provide haptic feedback
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        }
      }
      
      animationFrameId = requestAnimationFrame(scan);
    }
    
    function toggleGeneratedQR() {
      showGeneratedQR = !showGeneratedQR;
    }
    
    function regenerateQR() {
      generatedQRData = 'Test QR Code: ' + Math.random().toString(36).substring(2, 9);
      generateQR();
      addToLog('🔄 Generated new QR code');
    }
    
    function addToLog(message) {
      const timestamp = new Date().toLocaleTimeString();
      detectionLog = [{timestamp, message}, ...detectionLog.slice(0, maxLogEntries - 1)];
    }
    
    function truncateString(str, maxLength) {
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '...';
    }
  </script>
  
  <div class="qr-test-container">
    <h1>QR Scanner Test</h1>
    
    <div class="detection-stats">
      <div class="stat-item">
        <span class="stat-label">Total Detections:</span>
        <span class="stat-value">{detectionCount}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Last Detected:</span>
        <span class="stat-value">{lastDetectedData || 'None'}</span>
      </div>
    </div>
    
    <div class="camera-container">
      <video 
        bind:this={videoElement} 
        autoplay 
        playsinline 
        muted
        class="camera-video"
      ></video>
      <canvas bind:this={canvasElement} class="camera-canvas"></canvas>
      <div class="scan-indicator" class:active={!!lastDetectedData}></div>
    </div>
    
    <div class="detection-log">
      <h3>Detection Log:</h3>
      {#if detectionLog.length === 0}
        <p class="no-detections">No QR codes detected yet.</p>
      {:else}
        <ul class="log-list">
          {#each detectionLog as entry}
            <li class="log-entry">
              <span class="log-time">{entry.timestamp}</span>
              <span class="log-message">{entry.message}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    
    <div class="qr-test-actions">
      <button on:click={toggleGeneratedQR} class="action-button">
        {showGeneratedQR ? 'Hide Test QR' : 'Show Test QR'}
      </button>
      <button on:click={regenerateQR} class="action-button">
        Generate New QR
      </button>
    </div>
    
    {#if showGeneratedQR}
      <div class="generated-qr">
        <h3>Test QR Code:</h3>
        <div class="qr-image-container">
          {#if qrImageSrc}
            <img src={qrImageSrc} alt="Generated QR Code" class="qr-image" />
          {/if}
        </div>
        <div class="qr-data">
          Data: {generatedQRData}
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    .qr-test-container {
      max-width: 700px;
      margin: 0 auto;
      padding: 20px;
      font-family: sans-serif;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 20px;
      color: #333;
    }
    
    .detection-stats {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }
    
    .stat-item {
      display: flex;
      flex-direction: column;
    }
    
    .stat-label {
      font-size: 14px;
      color: #666;
    }
    
    .stat-value {
      font-size: 16px;
      font-weight: bold;
      color: #333;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .camera-container {
      position: relative;
      width: 100%;
      height: 300px;
      margin-bottom: 20px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .camera-video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .camera-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      pointer-events: none;
    }
    
    .scan-indicator {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: 5px solid transparent;
      box-sizing: border-box;
      pointer-events: none;
      transition: border-color 0.3s ease;
    }
    
    .scan-indicator.active {
      border-color: #4CAF50;
    }
    
    .detection-log {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f9f9f9;
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;
    }
    
    h3 {
      margin-top: 0;
      margin-bottom: 10px;
      font-size: 18px;
      color: #333;
    }
    
    .log-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .log-entry {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
      display: flex;
      gap: 10px;
    }
    
    .log-entry:last-child {
      border-bottom: none;
    }
    
    .log-time {
      color: #666;
      flex-shrink: 0;
    }
    
    .log-message {
      color: #333;
    }
    
    .no-detections {
      text-align: center;
      color: #666;
      font-style: italic;
    }
    
    .qr-test-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .action-button {
      flex: 1;
      padding: 10px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
    }
    
    .action-button:hover {
      background-color: #0069d9;
    }
    
    .generated-qr {
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 8px;
      text-align: center;
    }
    
    .qr-image-container {
      display: flex;
      justify-content: center;
      margin: 15px 0;
    }
    
    .qr-image {
      width: 200px;
      height: 200px;
    }
    
    .qr-data {
      font-family: monospace;
      padding: 10px;
      background-color: #e9e9e9;
      border-radius: 4px;
      word-break: break-all;
    }
  </style>