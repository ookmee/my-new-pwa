<!-- src/lib/components/SimpleQRTest.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import jsQR from 'jsqr';
    import QRCode from 'qrcode';
    
    // State variables
    let videoElement;
    let canvasElement;
    let canvasContext;
    let scanActive = false;
    let lastDetectedQR = null;
    let detectionCount = 0;
    let testQrImage = '';
    let testQrData = 'TEST QR CODE: ' + Date.now();
    
    onMount(async () => {
      await generateTestQR();
      await startCamera();
      startScanning();
    });
    
    onDestroy(() => {
      stopScanning();
      stopCamera();
    });
    
    async function generateTestQR() {
      testQrImage = await QRCode.toDataURL(testQrData);
    }
    
    async function startCamera() {
      try {
        const constraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play();
          
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
          canvasContext = canvasElement.getContext('2d');
          
          addLog("Camera started successfully");
        }
      } catch (error) {
        console.error('Error starting camera:', error);
        addLog("Error starting camera: " + error.message);
      }
    }
    
    function stopCamera() {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
    }
    
    function startScanning() {
      scanActive = true;
      scanQRCode();
    }
    
    function stopScanning() {
      scanActive = false;
    }
    
    function scanQRCode() {
      if (!scanActive) return;
      
      if (videoElement && canvasContext && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        canvasContext.drawImage(
          videoElement,
          0, 0,
          canvasElement.width, canvasElement.height
        );
        
        const imageData = canvasContext.getImageData(
          0, 0,
          canvasElement.width, canvasElement.height
        );
        
        try {
          const code = jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
            { inversionAttempts: "dontInvert" }
          );
          
          if (code) {
            // Display the QR code detection points
            drawQRCodeOutline(code.location);
            
            detectionCount++;
            lastDetectedQR = code.data;
            addLog(`Detected QR code: ${code.data.substring(0, 30)}${code.data.length > 30 ? '...' : ''}`);
            
            // Add vibration feedback
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        } catch (error) {
          console.error('Error processing QR data:', error);
          addLog("Error processing QR data: " + error.message);
        }
      }
      
      // Continue scanning
      requestAnimationFrame(scanQRCode);
    }
    
    function drawQRCodeOutline(location) {
      if (!location) return;
      
      canvasContext.strokeStyle = '#FF3B58';
      canvasContext.lineWidth = 4;
      
      // Draw the QR code outline
      canvasContext.beginPath();
      canvasContext.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
      canvasContext.lineTo(location.topRightCorner.x, location.topRightCorner.y);
      canvasContext.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
      canvasContext.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
      canvasContext.lineTo(location.topLeftCorner.x, location.topLeftCorner.y);
      canvasContext.stroke();
    }
    
    // Logging functionality
    let logs = [];
    const MAX_LOGS = 10;
    
    function addLog(message) {
      const timestamp = new Date().toLocaleTimeString();
      logs = [{timestamp, message}, ...logs.slice(0, MAX_LOGS - 1)];
    }
  </script>
  
  <div class="simple-qr-test">
    <h2>Simple QR Scanner Test</h2>
    
    <div class="test-area">
      <div class="camera-container">
        <video bind:this={videoElement} autoplay playsinline muted></video>
        <canvas bind:this={canvasElement}></canvas>
      </div>
      
      <div class="qr-status">
        <div class="status-item">
          <strong>Last Detected:</strong> 
          <span class="status-value">{lastDetectedQR ? lastDetectedQR : 'None'}</span>
        </div>
        <div class="status-item">
          <strong>Detection Count:</strong> 
          <span class="status-value">{detectionCount}</span>
        </div>
      </div>
      
      <div class="test-qr-container">
        <h3>Test QR Code:</h3>
        <div class="test-qr">
          <img src={testQrImage} alt="Test QR Code" class="test-qr-image" />
        </div>
        <div class="test-qr-data">
          <strong>Data:</strong> {testQrData}
        </div>
        <button class="test-button" on:click={generateTestQR}>Generate New Test QR</button>
      </div>
      
      <div class="log-container">
        <h3>Detection Log:</h3>
        {#if logs.length === 0}
          <p class="no-logs">No QR codes detected yet.</p>
        {:else}
          <ul class="log-list">
            {#each logs as log}
              <li class="log-entry">
                <span class="log-time">{log.timestamp}</span>
                <span class="log-message">{log.message}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
    
    <div class="instructions">
      <h3>Instructions:</h3>
      <ol>
        <li>This is a basic test to check if QR scanner is working properly</li>
        <li>First try scanning the test QR code above from another device</li>
        <li>If that works, try scanning any other QR code (e.g., from a product or website)</li>
        <li>The scanner should detect the code and display the content below</li>
        <li>If nothing is detected, there may be issues with camera permissions or the QR library</li>
      </ol>
    </div>
  </div>
  
  <style>
    .simple-qr-test {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      font-family: sans-serif;
    }
    
    h2 {
      text-align: center;
      margin-bottom: 20px;
      color: #333;
    }
    
    h3 {
      margin-top: 0;
      margin-bottom: 10px;
      font-size: 18px;
      color: #333;
    }
    
    .test-area {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .camera-container {
      position: relative;
      width: 100%;
      height: 300px;
      overflow: hidden;
      border-radius: 10px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    
    .qr-status {
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
    }
    
    .status-item {
      margin-bottom: 8px;
    }
    
    .status-value {
      font-family: monospace;
      word-break: break-all;
    }
    
    .test-qr-container {
      background-color: #f0f0f0;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    
    .test-qr {
      display: flex;
      justify-content: center;
      margin: 10px 0;
    }
    
    .test-qr-image {
      width: 150px;
      height: 150px;
    }
    
    .test-qr-data {
      font-family: monospace;
      background-color: #e0e0e0;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 10px;
      word-break: break-all;
    }
    
    .test-button {
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .test-button:hover {
      background-color: #45a049;
    }
    
    .log-container {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;
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
    
    .log-time {
      color: #666;
      flex-shrink: 0;
    }
    
    .log-message {
      color: #333;
    }
    
    .no-logs {
      color: #666;
      font-style: italic;
      text-align: center;
    }
    
    .instructions {
      margin-top: 30px;
      padding: 15px;
      background-color: #e9f7ef;
      border-radius: 8px;
    }
    
    .instructions ol {
      padding-left: 20px;
    }
    
    .instructions li {
      margin-bottom: 5px;
    }
  </style>