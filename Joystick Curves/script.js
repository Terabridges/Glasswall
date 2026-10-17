(async () => {
	// Wait for the CheerpJ runtime to be initialized before running any CheerpJ code
	await cheerpjInit();

// Load the RatesLibrary.jar file and get the Rates class
const cj = await cheerpjRunLibrary("/app/Joystick Curves/RatesLibrary/RatesLibrary.jar");
const Rates = await cj.Rates;
let ratesInstance = null; // Initialize the ratesInstance variable

// GLOBAL VARIABLES
let yInput = 0, xInput = 0;
let yOutput = 0, xOutput = 0;

// Create a default Rates instance with default parameters
ratesInstance = await new Rates(
	Number(document.getElementById("centerRate").value),
	Number(document.getElementById("maxRate").value),
	Number(document.getElementById("exponent").value),
	Number(document.getElementById("deadzone").value),
);

const inputElements = [
	document.getElementById("centerRate"),
	document.getElementById("maxRate"),
	document.getElementById("exponent"),
	document.getElementById("deadzone")
]

for (const inputElement of inputElements) {
	inputElement.addEventListener("input", async () => {
		ratesInstance = await new Rates(
			Number(document.getElementById("centerRate").value),
			Number(document.getElementById("maxRate").value),
			Number(document.getElementById("exponent").value),
			Number(document.getElementById("deadzone").value),
		);
		console.log("Rates instance created:", ratesInstance);
		renderGraph();
	});
}

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

		// Draw the output circles
		ctx.fillStyle = "#3b82f6"; // Blue
		ctx.beginPath();
		ctx.arc(originX + (xInput * scaleX), originY - (xOutput * scaleY), 10, 0, 2 * Math.PI);
		ctx.fill();
		ctx.fillStyle = "#ef4444"; // Red
		ctx.beginPath();
		ctx.arc(originX + (yInput * scaleX), originY - (yOutput * scaleY), 10, 0, 2 * Math.PI);
		ctx.fill();

		// When xOutput/yOutput is not 0, draw a dashed blue horizontal line intersecting the blue circle and parallel to the x-axis, and a dashed red vertical line intersecting the red circle and parallel to the x-axis
		if (xOutput !== 0) {
			ctx.strokeStyle = "#3b82f6";
			ctx.setLineDash([5, 5]);
			ctx.beginPath();
			ctx.moveTo(0, originY - (xOutput * scaleY));
			ctx.lineTo(w, originY - (xOutput * scaleY));
			ctx.stroke();
			ctx.setLineDash([]);
		}
		if (yOutput !== 0) {
			ctx.strokeStyle = "#ef4444";
			ctx.setLineDash([5, 5]);
			ctx.beginPath();
			ctx.moveTo(0, originY - (yOutput * scaleY));
			ctx.lineTo(w, originY - (yOutput * scaleY));
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}
}

// JOYSTICK INPUT
const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("stick");
let isDragging = false;
let initalKnobPos = { 
	left: "50%",
	top: "50%",
};
let centerX, centerY;

joystickKnob.addEventListener("mousedown", (e) => {
	isDragging = true;
	centerX = joystickKnob.getBoundingClientRect().left + joystickKnob.offsetWidth / 2;
	centerY = joystickKnob.getBoundingClientRect().top + joystickKnob.offsetHeight / 2;
});

joystickKnob.addEventListener("mousemove", (e) => {
	if (!isDragging) return;
	const x = e.clientX - centerX;
	const y = e.clientY - centerY;
	const distance = Math.sqrt(x * x + y * y);
	const maxDistance = (joystick.offsetWidth / 2);
	if (distance > maxDistance) {
		const angle = Math.atan2(y, x);
		const newX = Math.cos(angle) * maxDistance;
		const newY = Math.sin(angle) * maxDistance;
		joystickKnob.style.left = `calc(${initalKnobPos.left} + ${newX}px)`;
		joystickKnob.style.top = `calc(${initalKnobPos.top} + ${newY}px)`;
	} else {
		joystickKnob.style.left = `calc(${initalKnobPos.left} + ${x}px)`;
		joystickKnob.style.top = `calc(${initalKnobPos.top} + ${y}px)`;
	}
	updateOutputValues();
});

joystickKnob.addEventListener("mouseup", () => {
	isDragging = false;
	if (joystickKnob.style.left !== initalKnobPos.left) {
		joystickKnob.style.left = initalKnobPos.left;
	}
	if (joystickKnob.style.top !== initalKnobPos.top) {
		joystickKnob.style.top = initalKnobPos.top;
	}
	updateOutputValues();
	centerX = joystickKnob.getBoundingClientRect().left + joystickKnob.offsetWidth / 2;
	centerY = joystickKnob.getBoundingClientRect().top + joystickKnob.offsetHeight / 2;
});

joystickKnob.addEventListener("mouseleave", () => {
	isDragging = false;
	if (joystickKnob.style.left !== initalKnobPos.left) {
		joystickKnob.style.left = initalKnobPos.left;
	}
	if (joystickKnob.style.top !== initalKnobPos.top) {
		joystickKnob.style.top = initalKnobPos.top;
	}
	updateOutputValues();
	centerX = joystickKnob.getBoundingClientRect().left + joystickKnob.offsetWidth / 2;
	centerY = joystickKnob.getBoundingClientRect().top + joystickKnob.offsetHeight / 2;
});

// Use joystick knob position (left and top percentage value) and the Rates instance to calculate the output values and update the meter fills
async function updateOutputValues() {
	if (!ratesInstance) return; // If ratesInstance is not defined, exit the function
	let centerX = joystickKnob.getBoundingClientRect().left + joystickKnob.offsetWidth / 2;
	let centerY = joystickKnob.getBoundingClientRect().top + joystickKnob.offsetHeight / 2;
	const leftPercent = (centerX - joystick.getBoundingClientRect().left) / joystick.offsetWidth;
	const topPercent = (centerY - joystick.getBoundingClientRect().top) / joystick.offsetHeight;
	console.log(`Joystick Position: (${leftPercent.toFixed(2)}, ${(topPercent).toFixed(2)})`);
	xInput = (leftPercent - 0.5) * 2;
	yInput = (topPercent - 0.5) * 2;
	yInput = -yInput; // Invert the Y input to match the joystick's coordinate system
	console.log(`Joystick Input: (${xInput.toFixed(2)}, ${yInput.toFixed(2)})`);

	xOutput = await ratesInstance.apply(xInput);
	yOutput = await ratesInstance.apply(yInput);

	document.documentElement.style.setProperty('--joystick-x-value', xOutput);
	document.documentElement.style.setProperty('--joystick-y-value', yOutput);

	// Update the output values display
	document.getElementById("outputX").textContent = xOutput.toFixed(2);
	document.getElementById("outputY").textContent = yOutput.toFixed(2);

	// Update the graph with the new output values
	renderGraph();
}

renderGraph();

})();
