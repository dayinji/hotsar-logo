
var container, stats;

var controls, camera, scene, raycaster, renderer, forceSphere, mouse = new THREE.Vector2();
var hand;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
var isUserInteracting = false,
onMouseDownMouseX = 0, onMouseDownMouseY = 0,
lon = 90, onMouseDownLon = 0,
lat = 0, onMouseDownLat = 0,
phi = 0, theta = 0;


var ParticlesInitPosition = [];
var ParticlesInitNormal = [];

var last = performance.now();

var gpuCompute;
var velocityVariable;
var positionVariable;
var positionUniforms;
var velocityUniforms;
var particleUniforms;

var forceRadius = 100.0;
var pointSize = 4;
var hasLoadObj = false;

var WIDTH = 512;
var particleCount = WIDTH*WIDTH;

var timeScale = 10.;
var life = 150;

var loadingInfo = document.getElementById( 'loading' );

var posFShaderText = "uniform float delta;"+
"uniform float floorPosY;"+
"uniform bool isReset;"+
"uniform sampler2D originPosition;"+
"void main()	{"+
"	vec2 uv = gl_FragCoord.xy / resolution.xy;"+
"	vec3 position = texture2D( texturePosition, uv ).xyz;"+
"	vec3 velocity = texture2D( textureVelocity, uv ).xyz;"+
"	if (isReset) {"+
"		vec3 originPos = texture2D( originPosition, uv ).xyz;"+
"		float easing = 0.3;"+
"		gl_FragColor = vec4(position + (originPos - position)*easing, 1.0);"+
"	} else {"+
"		gl_FragColor = vec4( position + velocity * delta * 20.  , 1.0 );"+
"		if (position.y < floorPosY) {"+
"			gl_FragColor = vec4(gl_FragColor.x, floorPosY, gl_FragColor.z, 1.0);"+
"		}"+
"	}"+
"}";
var velFShaderText = "uniform float delta;"+
"uniform float floorPosY;"+
"uniform vec3 forcePos;"+
"uniform float forceRadius;"+
"uniform bool isReset;"+
"uniform sampler2D perlin1;"+
"uniform sampler2D perlin2;"+
"uniform sampler2D perlin3;"+
"uniform float timeScale;"+
"uniform float life;"+
"vec3 g = vec3(0, -8, 0);"+
"float rand(vec2 co){"+
"	return sin(dot(co.xy ,vec2(12.9898,78.233)));"+
"}"+

"vec3 ComputeCurl(float x, float y, float z) {	" +
"	float eps = 0.05;" +
"	float n1, n2, a, b;" +
"	vec3 curl;"+
"	x = x / 500.;"+
"	y = y / 500.;"+
"	z = z / 500.;"+

"	n1 = texture2D(perlin1, vec2(y+eps, z)).r;"+
"	n2 = texture2D(perlin1, vec2(y-eps, z)).r;"+
"	a = (n1 - n2)/(2.*eps);"+
"	n1 = texture2D(perlin1, vec2(y, z+eps)).r;"+
"	n2 = texture2D(perlin1, vec2(y, z-eps)).r;"+
"	b = (n1 - n2)/(2.*eps);"+

"	curl.x = a - b;"+

"	n1 = texture2D(perlin2, vec2(x, z+eps)).r;"+
"	n2 = texture2D(perlin2, vec2(x, z-eps)).r;"+
"	a = (n1 - n2)/(2.*eps);"+
"	n1 = texture2D(perlin2, vec2(x+eps, z)).r;"+
"	n2 = texture2D(perlin2, vec2(x+eps, z)).r;"+
"	b = (n1 - n2)/(2.*eps);"+

"	curl.y = a - b;"+

"	n1 = texture2D(perlin3, vec2(x+eps, y)).r;"+
"	n2 = texture2D(perlin3, vec2(x-eps, y)).r;"+
"	a = (n1 - n2)/(2.*eps);"+
"	n1 = texture2D(perlin3, vec2(x, y+eps)).r;"+
"	n2 = texture2D(perlin3, vec2(x, y-eps)).r;"+
"	b = (n1 - n2)/(2.*eps);"+

"	curl.z = a - b;"+

"	return curl;"+
"}"	 +
"void main() {"+
"	float velFactor = 1./(300.*timeScale);"+
"	float life = timeScale*life;"+
"	if (isReset) {"+
"		gl_FragColor = vec4( 0.0, 0.0, 0.0 , life );"+
"	} else {"+
"		vec2 uv = gl_FragCoord.xy / resolution.xy;"+
"		vec3 position = texture2D( texturePosition, uv ).xyz;"+
"		vec3 velocity = texture2D( textureVelocity, uv ).xyz;"+
"		float lifeReduce = rand(position.zy) + 1.;"+
"		float nextLife =  texture2D( textureVelocity, uv ).a - lifeReduce;"+
"		if (texture2D( textureVelocity, uv ).a != life) {"+
"			gl_FragColor = vec4( ComputeCurl(position.x, position.y, position.z)*velFactor, nextLife );"+
"			if (position.y == floorPosY) {"+
"				if (length(gl_FragColor.xyz) < 0.5) {"+
"					gl_FragColor = vec4(0, 0, 0, nextLife);"+
"				} else {"+
"					vec3 floorNormal = normalize(vec3(rand(position.xy), abs(rand(position.xz)), rand(position.yz)));"+
"					gl_FragColor = vec4(reflect(gl_FragColor.xyz, floorNormal)*0.85, nextLife);"+
"				}"+
"			}"+
"		} else {"+
"			gl_FragColor = vec4( velocity , life );"+
"		} "+
"		vec3 ForcePos = vec3(forcePos.x, forcePos.y, forcePos.z);"+
"		if (length(position - ForcePos) <= forceRadius) {"+
"			vec3 dir = normalize(position - ForcePos);"+
"			float force = (forceRadius - length(position - ForcePos)) / 15.0;"+
"			gl_FragColor = vec4(gl_FragColor.xyz + ComputeCurl(position.x, position.y, position.z)*velFactor, nextLife);"+
"		}"+
"	}"+
"}";
var vertexShaderText = "attribute vec2 reference;"+
"varying vec3 Normal;"+
"varying vec4 vWorldPosition;"+
"varying vec3 FragPos;"+
"varying float isLife;"+
"uniform sampler2D texturePosition;"+
"uniform sampler2D textureVelocity;"+
"uniform float myPointSize;"+
"uniform float timeScale;"+
"uniform float life;"+
"void main()"+
"{"+
"	vec3 tmpPos = texture2D( texturePosition, reference ).xyz;"+
"	vec4 vWorldPosition = modelMatrix * vec4(tmpPos, 1.0);"+
"	gl_Position = projectionMatrix * viewMatrix * vWorldPosition;"+
"	float leftLife = texture2D( textureVelocity, reference ).a;"+
"	gl_PointSize = leftLife / timeScale / (life*2.) + 0.5;"+
"	isLife = 1.;"+
"	if ( leftLife < 1.)"+
"		isLife = 0.;"+
"	Normal = normal;"+
"	FragPos = tmpPos;"+

"}";
/*var fragmentShaderText = "varying vec3 Normal;"+
"varying vec3 FragPos;"+
"vec3 lightPos = vec3(0, 600, 300);"+
"vec3 diffuse = vec3(0.3, 0.3 ,0.3);"+
"void main()"+
"{"+
"	vec3 norm = normalize(Normal);"+
"	vec3 lightDir = normalize(lightPos - FragPos);"+
"	float diff = max(dot(norm, lightDir), 0.0);"+
"	diff = diff + 0.2;"+
"	if (diff > 1.0)"+
"		diff = 1.0;"+
"	diffuse = diff*diffuse;"+
"	gl_FragColor = vec4(diffuse, 1.0);"+
"}";*/


var fragmentShaderText = "varying vec3 Normal;"+
"varying vec3 FragPos;"+
"uniform vec3 eyePos;"+
"vec3 lightColor = vec3(0.9, 0.9, 0.9);"+
"vec3 lightPos = vec3(0, 500, -700);"+
"vec3 diffuse = vec3(0.2, 0.2, 0.2);"+
"float shininess = 16.;"+
"float specularStrength = 0.3;"+
"varying float isLife;"+
"void main()"+
"{"+
"	if (isLife == 0.)"+
"		discard;"+
"	vec3 norm = normalize(Normal);"+
"	vec3 lightDir = normalize(lightPos - FragPos);"+
"	vec3 viewDir = normalize(eyePos - FragPos);"+
"	vec3 reflectDir = reflect(lightDir, Normal);"+
"	float diff = max(dot(norm, lightDir), 0.0);"+
"	diff = diff + 0.1;"+
"	if (diff > 1.0)"+
"		diff = 1.0;"+
"	diffuse = diff*diffuse;"+
"	vec3 specularColor = specularStrength * lightColor * pow(max(dot(viewDir, reflectDir), 0.0), shininess);"+
"	gl_FragColor = vec4(diffuse+specularColor, 1.0);"+
"}";

//detectDivice();

function detectDivice() {
    var system = {
        win: false,
        mac: false,
        xll: false,
        ipad:false
    };
    //检测平台
    var p = navigator.platform;
    system.win = p.indexOf("Win") == 0;
    system.mac = p.indexOf("Mac") == 0;
    system.x11 = (p == "X11") || (p.indexOf("Linux") == 0);
    system.ipad = (navigator.userAgent.match(/iPad/i) != null)?true:false;
    
    if (system.win || system.mac || system.xll||system.ipad) {
    	pointSize = 2.0;
		WIDTH = 1024;
		particleCount = WIDTH*WIDTH;

    } else {

    }

}

init();
animate();


function init() {

	container = document.createElement( 'div' );
	document.body.appendChild( container );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
	camera.position.z = 500;
	camera.position.y = 0;

	// scene

	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0x0d0d0d, 2,  800);
	//scene.fog = new THREE.Fog( 0x00ff00, 2,  500);

	// Lights

	scene.add( new THREE.HemisphereLight( 0x443333, 0x111122 ) );

	addShadowedLight( 500, 1300, 500, 0xffffff, 1 );
	//addShadowedLight( 0.5, 1, -1, 0xffaa00, 0.5 );

	// OBJ
	var manager = new THREE.LoadingManager();

	var onProgress = function ( xhr ) {
		if ( xhr.lengthComputable ) {
			var percentComplete = Math.round(xhr.loaded / xhr.total * 100, 2);
			console.log( percentComplete + '% downloaded' );
			loadingInfo.textContent = "Download Model " + percentComplete + "%";
		}
	};

	var onError = function ( xhr ) {
	};


	var loader = new THREE.OBJLoader( manager );
	loader.load( 'hand.obj', function ( object ) {

		object.traverse( function ( child ) {

			if ( child instanceof THREE.Mesh ) {
				child.castShadow = true;
				child.receiveShadow = true;
				
				var textureLoader = new THREE.TextureLoader();
				var material = new THREE.MeshPhongMaterial( {
					color: 0xdddddd,
					specular: 0x222222,
					shininess: 35,
					map: textureLoader.load( "img/Particleboard_1_Diffuse_Free 5K texturesVOL.4_by_Milos_Belanec.jpg" ),
					specularMap: textureLoader.load( "img/Particleboard_1_Reflect_Free 5K texturesVOL.4_by_Milos_Belanec.jpg" ),
					normalMap: textureLoader.load( "img/Particleboard_1_Normal_Free 5K texturesVOL.4_by_Milos_Belanec.jpg" ),
					normalScale: new THREE.Vector2( 0.8, 0.8 )
				} );


				hand = new THREE.Mesh(child.geometry, material);
				hand.position.set(0, 0, 300);

				scene.add(hand);

				loadingInfo.textContent = "Initing Particles 40%";

				hasLoadObj = true;

			}

		} );


		//object.position.y = -110;
		//scene.add( object );

	}, onProgress, onError );

	raycaster = new THREE.Raycaster();


	renderer = new THREE.WebGLRenderer();
	renderer.setClearColor( scene.fog.color );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	renderer.gammaInput = true;
	renderer.gammaOutput = true;

	renderer.shadowMap.enabled = true;
	renderer.shadowMap.renderReverseSided = false;


	stats = new Stats();
	//container.appendChild( stats.dom );

	controls = new THREE.OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;
	controls.dampingFactor = 0.8;
	controls.zoomSpeed = 0.3;
	controls.rotateSpeed = 0.5;
	//controls.enableRotate = false;

	document.addEventListener("touchmove", touchMove, false);
	document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	/*document.addEventListener( 'mousedown', onDocumentMouseDown, false );
	document.addEventListener( 'wheel', onDocumentMouseWheel, false );*/

	window.addEventListener( 'resize', onWindowResize, false );

	mouse.x = -1;
	mouse.y = -1;

	initGUI();

}

function initGUI() {
	var gui = new dat.GUI();

	var effectController = {
		reset: function() { positionUniforms.isReset.value = true; velocityUniforms.isReset.value = true; 
			setTimeout(function(){
				positionUniforms.isReset.value = false; velocityUniforms.isReset.value = false;
				camera.position.z = 200;
				camera.position.y = 0;
				onMouseDownMouseX = 0, onMouseDownMouseY = 0,
				lon = 90, onMouseDownLon = 0,
				lat = 0, onMouseDownLat = 0,
				phi = 0, theta = 0;
			}, 1000)},
		particleCount: 0.5
	};

	var valuesChanger = function() {

	};

	valuesChanger();

	gui.add( effectController, "reset");
}

function touchMove(e) {
    e.preventDefault();
    var touches = e.changedTouches;


    mouse.x = ( touches[0].pageX / window.innerWidth ) * 2 - 1;
	mouse.y = - (  touches[0].pageY / window.innerHeight ) * 2 + 1;
}

function onWindowResize() {

	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}


function onDocumentMouseDown( event ) {

	event.preventDefault();

	onPointerDownPointerX = event.clientX;
	onPointerDownPointerY = event.clientY;

	onPointerDownLon = lon;
	onPointerDownLat = lat;

	isUserInteracting = true;

	//document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	document.addEventListener( 'mouseup', onDocumentMouseUp, false );

}

function onDocumentMouseMove( event ) {

	if (isUserInteracting) {
		lon = ( event.clientX - onPointerDownPointerX ) * 0.1 + onPointerDownLon;
		lat = ( event.clientY - onPointerDownPointerY ) * 0.1 + onPointerDownLat;
	}

	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

}

function onDocumentMouseUp( event ) {

	//document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
	isUserInteracting = false;
	document.removeEventListener( 'mouseup', onDocumentMouseUp, false );

}

function onDocumentMouseWheel( event ) {

	fov += event.deltaY * 0.05;

	camera.projectionMatrix.makePerspective( fov, window.innerWidth / window.innerHeight, 1, 1100 );

}

//

function animate() {

	requestAnimationFrame( animate );
	if (hasLoadObj) {
		render();
	}

	stats.update();

}

function render() {

	var now = performance.now();
	var delta = (now - last) / 1000;

	if (delta > 1) delta = 1; // safety cap on large deltas
	last = now;

	lon += .03;
	lat = Math.max( - 85, Math.min( 85, lat ) );
	phi = THREE.Math.degToRad( 90 - lat );
	theta = THREE.Math.degToRad( lon );

	controls.update();

	var dist = camera.position.distanceTo(new THREE.Vector3(0, camera.position.y, 0));
	camera.lookAt(hand.position);
	//camera.position.x = dist * Math.sin( phi ) * Math.cos( theta );
	//camera.position.y = dist * Math.cos( phi ) + 150;
	//camera.position.z = dist * Math.sin( phi ) * Math.sin( theta );

	renderer.render( scene, camera );

}


function addShadowedLight( x, y, z, color, intensity ) {

	var directionalLight = new THREE.DirectionalLight( color, intensity );
	directionalLight.position.set( x, y, z );
	scene.add( directionalLight );

	directionalLight.castShadow = true;

	var d = 500;
	directionalLight.shadow.camera.left = -d;
	directionalLight.shadow.camera.right = d;
	directionalLight.shadow.camera.top = d;
	directionalLight.shadow.camera.bottom = -d;

	directionalLight.shadow.camera.near = 1;
	directionalLight.shadow.camera.far = 10000;

	directionalLight.shadow.mapSize.width = WIDTH*2;
	directionalLight.shadow.mapSize.height = WIDTH*2;

	directionalLight.shadow.bias = -0.0001;

}

function fillPositionTexture( texture ) {

	var theArray = texture.image.data;

	for ( var k = 0, kl = theArray.length; k < kl; k += 4 ) {

		var index = k / 4;

		theArray[ k + 0 ] = ParticlesInitPosition[index].x;
		theArray[ k + 1 ] = ParticlesInitPosition[index].y;
		theArray[ k + 2 ] = ParticlesInitPosition[index].z;
		theArray[ k + 3 ] = 1;

	}


}

function fillVelocityTexture( texture ) {

	var theArray = texture.image.data;

	for ( var k = 0, kl = theArray.length; k < kl; k += 4 ) {

		theArray[ k + 0 ] = 0;
		theArray[ k + 1 ] = 0;
		theArray[ k + 2 ] = 0;
		theArray[ k + 3 ] =  timeScale*life;

	}

}
function getPassThroughFragmentShader() {

	return	"uniform sampler2D texture;\n" +
			"\n" +
			"void main() {\n" +
			"\n" +
			"	vec2 uv = gl_FragCoord.xy / resolution.xy;\n" +
			"\n" +
			"	gl_FragColor = texture2D( texture, uv );\n" +
			"\n" +
			"}\n";

}