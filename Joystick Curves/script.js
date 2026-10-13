(async () => {
	// Wait for the CheerpJ runtime to be initialized before running any CheerpJ code
	await cheerpjInit();

// Load the RatesLibrary.jar file and get the Rates class
const cj = await cheerpjRunLibrary("/app/Joystick Curves/RatesLibrary/RatesLibrary.jar");
const Rates = await cj.Rates;
let ratesInstance = null; // Initialize the ratesInstance variable

// Create an instance of the Rates class whenever the form is submitted
document.getElementById("rates-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	ratesInstance = await new Rates(
		Number(document.getElementById("centerRate").value),
		Number(document.getElementById("maxRate").value),
		Number(document.getElementById("exponent").value),
		Number(document.getElementById("deadzone").value),
	); // Use the parameters from the form inputs to create the Rates instance
	console.log("Rates instance created:", ratesInstance);
	// You can now use the ratesInstance to call methods from the Rates class
	renderGraph(); // Call renderGraph to update the graph with the new ratesInstance
});

// Populate the graph with a grid and axes
const canvas = document.getElementById("graphCanvas");
const ctx = canvas.getContext("2d");

// 1. Get the size of the canvas in CSS pixels
const width = canvas.getBoundingClientRect().width;
const height = canvas.getBoundingClientRect().height;

// 2. Get the device pixel ratio
const dpr = 4;
console.log(`Device Pixel Ratio: ${dpr}`);

// 3. Scale the internal drawing buffer size
canvas.width = width * dpr;
canvas.height = height * dpr;

// 4. Scale the visual element back down using CSS
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

// 5. Scale the canvas context so your drawing coordinates match CSS pixels
ctx.scale(dpr, dpr);

pan = { x: 0, y: 0, zoom: 1 };
isDraggingGraph = false;
lastMousePos = { x: 0, y: 0 };

// Graph Inputs
canvas.addEventListener('wheel', (e) => {
	e.preventDefault();
	pan.zoom *= Math.exp(-e.deltaY * 0.0005);
	pan.zoom = Math.max(0.1, Math.min(pan.zoom, 5));
	renderGraph();
});
canvas.addEventListener('mousedown', (e) => {
	isDraggingGraph = true;
	lastMousePos = { x: e.clientX, y: e.clientY };
});
window.addEventListener('mousemove', (e) => {
	if (!isDraggingGraph) return;
	pan.x += (e.clientX - lastMousePos.x);
	pan.y += (e.clientY - lastMousePos.y);
	lastMousePos = { x: e.clientX, y: e.clientY };
	renderGraph();
});
window.addEventListener('mouseup', () => isDraggingGraph = false);

async function renderGraph() {
	// let's make the entire scale of the graph in units of 0.01 and the max scale in units of 1.0, so the graph will always be in the range of -1.0 to 1.0 on both axes

	const w = canvas.width = canvas.clientWidth;
	const h = canvas.height = canvas.clientHeight;

	ctx.clearRect(0, 0, w, h);

	// Camera Logic
	const scaleX = (w / 1) * pan.zoom; 
	const scaleY = scaleX; 
	const originX = w / 2 + pan.x;
	const originY = h / 2 + pan.y;

	// Grid
	ctx.strokeStyle = "#1e293b";
	ctx.lineWidth = 1;

	function calculateStep(graphZoom) {
		if (1 / graphZoom <= 1) return 0.05; 
		let unroundedStep = Math.max(1, Math.floor((1.5 * 1) / graphZoom));
		// Simple steps
		console.log("Unrounded Step:", unroundedStep);
		if (unroundedStep >= 15) return 1.0;
		if (unroundedStep >= 8) return 0.5;
		if (unroundedStep >= 4) return 0.2;
		if (unroundedStep >= 1) return 0.1;
		return 0.05; // Default step
	}
	
	// Vertical Lines (X-axis)
	const xStep =  calculateStep(pan.zoom);
	const numLinesX = Math.ceil((w / (scaleX * xStep)) / 2) * 2 + 1;
	const startX =  Math.ceil(0-numLinesX - pan.x / (scaleX * xStep));
	const endX = Math.floor(numLinesX - pan.x / (scaleX * xStep));
	for(let i=startX; i<endX; i++) {
		const val = i * xStep;
		const x = originX + val * scaleX;
		if(x < 0 || x > w) continue;
		ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
		if (i === 0) continue;
		ctx.fillStyle = "#64748b"; ctx.font = "12px monospace"; ctx.fillText(Number(val.toPrecision(2)), x - 4, originY + 20);
	}
	
	// Horizontal Lines (Y-Axis)
	const yStep = calculateStep(pan.zoom);
	const numLinesY = Math.ceil((h / (scaleY * yStep)) / 2) * 2 + 1;
	const startY =  Math.ceil(0-numLinesY + pan.y / (scaleY * yStep));
	const endY = Math.floor(numLinesY + pan.y / (scaleY * yStep));
	for(let i=startY; i<endY; i++) {
		const val = i * yStep;
		const y = originY - val * scaleY;
		if(y < 0 || y > h) continue;
		ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
		if(i === 0) continue;
		ctx.fillStyle = "#64748b"; ctx.font = "12px monospace"; ctx.fillText(Number(val.toPrecision(2)), originX - (8 + 6 * Number(val.toPrecision(2)).toString().length), y + 4);
	}

	// Draw Axes
	ctx.strokeStyle = "#94a3b8";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(originX, 0); ctx.lineTo(originX, h); // Y Axis
	ctx.moveTo(0, originY); ctx.lineTo(w, originY); // X Axis
	ctx.stroke();

	// Render the curve if ratesInstance is defined
	console.log("Rendering graph. ratesInstance is:", ratesInstance);
	if (ratesInstance) {
		ctx.strokeStyle = "#ffda00";
		ctx.lineWidth = 3;
		ctx.beginPath();
		
		let startDraw = false;
		for(let px = 0; px < w; px+=2) { // Step optimization
			const mathX = (px - originX) / scaleX;
			// limit mathX to the range [-1, 1] to avoid unnecessary calculations
			if (mathX < -1 || mathX > 1) {
				startDraw = false;
				continue;
			}
			const mathY = await ratesInstance.apply(mathX); // Call the apply method on the ratesInstance
			const py = originY - (mathY * scaleY);

			if (py < -1000 || py > h + 1000) {
				startDraw = false;
				continue;
			}

			if (!startDraw) {
				ctx.moveTo(px, py);
				startDraw = true;
			} else {
				ctx.lineTo(px, py);
			}
		}
		ctx.stroke();

		/*
		// Draw dashed vertical lines to at x=-1 and x=1 to represent the min and max value of a joystick input
		ctx.strokeStyle = "#ffda00";
		ctx.lineWidth = 1;
		ctx.setLineDash([5, 5]);
		const minX = originX + (-1 * scaleX);
		const maxX = originX + (1 * scaleX);
		ctx.beginPath();
		ctx.moveTo(minX, 0); ctx.lineTo(minX, h);
		ctx.moveTo(maxX, 0); ctx.lineTo(maxX, h);
		ctx.stroke();
		ctx.setLineDash([]); // Reset line dash
		*/
	}
}


renderGraph();

})();
