var logoController;
var particleUniforms;

var posFShaderText = document.getElementById('posFShaderText').textContent;
var velFShaderText = document.getElementById('velFShaderText').textContent;
var vertexShaderText = document.getElementById('vertexShaderText').textContent;
var fragmentShaderText = document.getElementById('fragmentShaderText').textContent;
var shadowFragmentShaderText = document.getElementById('fs-particles-shadow').textContent;

var timeScale = 10.;
var life = 150;
var forceRadius = 100.0;
var pointSize = 4;



function LogoController(canvas) {
	this.canvas = canvas;
	this.WIDTH = 128;
	this.inited = false;
	this.life = 70;
	this.mouse = new THREE.Vector2(9999, 9999);
	this.init = function() {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
		this.camera.position.z = 120;
		this.camera.position.y = 0;
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));


		var s = 50;
		this.shadowCamera = new THREE.OrthographicCamera( -s, s, s, -s, .1, 200 );
		this.shadowCamera.position.set( -80, 50, 60 );
		this.shadowCamera.lookAt( new THREE.Vector3() );

		this.shadowBufferSize = 1024;
		this.shadowBuffer = new THREE.WebGLRenderTarget( this.shadowBufferSize, this.shadowBufferSize, {
			wrapS: THREE.ClampToEdgeWrapping,
			wrapT: THREE.ClampToEdgeWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat
		} );

		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.Fog( 0x0d0d0d, 2,  800);

		this.scene.add( new THREE.HemisphereLight( 0x443333, 0x111122 ) );
		this.addShadowedLight( 500, 1300, 500, 0xffffff, 1 );

		this.raycaster = new THREE.Raycaster();

		this.processData();

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas
		});
		this.renderer.setClearColor( this.scene.fog.color );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.gammaInput = true;
		this.renderer.gammaOutput = true;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.renderReverseSided = false;

		/*this.controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.8;
		this.controls.zoomSpeed = 0.3;
		this.controls.rotateSpeed = 0.5;*/


	}

	this.onTouchMove = function(e) {
		var touch = e.touches[0];
		this.mouse.x = touch.pageX / window.innerWidth * 2 - 1;
		this.mouse.y = - (touch.pageY / window.innerHeight * 2 - 1);
	}
	this.onTouchEnd = function(e) {
		this.mouse.x = 9999;
		this.mouse.y = - 9999;
	}
	this.onMouseMove = function(e) {
		this.mouse.x = e.clientX / window.innerWidth * 2 - 1;
		this.mouse.y = - (e.clientY / window.innerHeight * 2 - 1);
	}

	this.processData = function() {
		$.get("vertices.txt", function(data) {
			var vertices = data.split("\n");
			var clampCount =this.WIDTH * this.WIDTH;

			this.positions = new Float32Array( clampCount * 3 );
			var normals = new Float32Array( clampCount * 3 );

			for (var i = 0 ; i < clampCount ; i++) {
				var pos = vertices[i*2].split(" ");
				var nor = vertices[i*2+1].split(" ");
				if (pos.length == 3 && nor.length == 3) {
					this.positions[i*3] = pos[0];
					this.positions[i*3 + 1] = pos[1]-10;
					this.positions[i*3 + 2] = pos[2];
					normals[i*3] = nor[0];
					normals[i*3 + 1] = nor[1];
					normals[i*3 + 2] = nor[2];
				} else {
					console.log("data process error");
				}
			}

			var positionsLength = this.WIDTH * this.WIDTH * 3 * 18;
			var cubeVerticesPositions = new Float32Array( positionsLength );
			var cubeVerticesNormals = new Float32Array( positionsLength );

			var p = 0;
			for( var j = 0; j < positionsLength; j += 3 ) {
				cubeVerticesPositions[ j ] = p;
				cubeVerticesPositions[ j + 1 ] = Math.floor( p / 18 );
				cubeVerticesPositions[ j + 2 ] = p % 18;
				p++;

				var index = Math.floor( p / 18 / 3 ) ;
				cubeVerticesNormals[ j ] = normals[index*3];
				cubeVerticesNormals[ j + 1 ] = normals[index*3 + 1];
				cubeVerticesNormals[ j + 2 ] = normals[index*3 + 2];
			}

			var geometry = new THREE.BufferGeometry();
			geometry.addAttribute( 'position', new THREE.BufferAttribute( cubeVerticesPositions, 3 ) );
			geometry.addAttribute( 'normal', new THREE.BufferAttribute( cubeVerticesNormals, 3 ) );
			/*geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
			var references = new THREE.BufferAttribute( new Float32Array( clampCount * 2 ), 2 );
			geometry.addAttribute( 'reference', references );

			for( var v = 0 ; v < clampCount ; v++ ) {

				references.array[ v * 2     ] = (v % this.WIDTH) / this.WIDTH;
				references.array[ v * 2 + 1 ] = Math.floor(v / this.WIDTH) / this.WIDTH;

			}*/
			this.particleUniforms = {
				texturePosition: { type: "t", value: null },
				textureVelocity: { type: "t", value: null },
				width: { type: "f", value: this.WIDTH },
				height: { type: "f", value: this.WIDTH },

				windowSize: { type: "2fv", value: new THREE.Vector2(window.innerWidth*window.devicePixelRatio, window.innerHeight*window.devicePixelRatio) },
				// overlayTexture: { type: "t", value: new THREE.TextureLoader().load( 'img/overlay3.jpg' ) },
				
				boxScale: { type: 'v3', value: new THREE.Vector3(0.3, 0.2, 0.8) },
				meshScale: { type: 'f', value: 1 },

				depthTexture: { type: 't', value: this.shadowBuffer },
				shadowV: { type: 'm4', value: new THREE.Matrix4() },
				shadowP: { type: 'm4', value: new THREE.Matrix4() },
				resolution: { type: 'v2', value: new THREE.Vector2( this.shadowBufferSize, this.shadowBufferSize ) },
				lightPosition: { type: 'v3', value: new THREE.Vector3() },

				boxVertices: { type: '3fv', value: [

					-1,-1,-1,
					-1,-1, 1,
					-1, 1, 1,

					-1,-1,-1,
					-1, 1, 1,
					-1, 1,-1,

					1, 1,-1,
					1,-1,-1,
					-1,-1,-1,

					1, 1,-1,
					-1,-1,-1,
					-1, 1,-1,

					1,-1, 1,
					-1,-1, 1,
					-1,-1,-1,

					1,-1, 1,
					-1,-1,-1,
					1,-1,-1,

					1, 1, 1,
					1,-1, 1,
					1,-1,-1,

					1, 1,-1,
					1, 1, 1,
					1,-1,-1,

					-1,-1, 1,
					1,-1, 1,
					1, 1, 1,

					-1, 1, 1,
					-1,-1, 1,
					1, 1, 1,

					-1, 1,-1,
					-1, 1, 1,
					1, 1, 1,

					1, 1,-1,
					-1, 1,-1,
					1, 1, 1

				] },
				boxNormals: { type: '3fv', value: [

					1, 0, 0,
					0, 0, 1,
					0, 1, 0

				] },

			};

			this.material = new THREE.RawShaderMaterial( {

				uniforms: this.particleUniforms,
				vertexShader: vertexShaderText,
				fragmentShader: fragmentShaderText,
				side: THREE.DoubleSide,
				shading: THREE.FlatShading
			} );

			this.particleShadowUniforms = {
				texturePosition: { type: "t", value: null },
				textureVelocity: { type: "t", value: null },
				width: { type: "f", value: this.WIDTH },
				height: { type: "f", value: this.WIDTH },
				
				boxScale: { type: 'v3', value: new THREE.Vector3(0.3, 0.2, 0.8) },
				meshScale: { type: 'f', value: 1 },

				shadowV: { type: 'm4', value: new THREE.Matrix4() },
				shadowP: { type: 'm4', value: new THREE.Matrix4() },
				resolution: { type: 'v2', value: new THREE.Vector2( this.shadowBufferSize, this.shadowBufferSize ) },
				lightPosition: { type: 'v3', value: new THREE.Vector3() },

				boxVertices: { type: '3fv', value: [

					-1,-1,-1,
					-1,-1, 1,
					-1, 1, 1,

					-1,-1,-1,
					-1, 1, 1,
					-1, 1,-1,

					1, 1,-1,
					1,-1,-1,
					-1,-1,-1,

					1, 1,-1,
					-1,-1,-1,
					-1, 1,-1,

					1,-1, 1,
					-1,-1, 1,
					-1,-1,-1,

					1,-1, 1,
					-1,-1,-1,
					1,-1,-1,

					1, 1, 1,
					1,-1, 1,
					1,-1,-1,

					1, 1,-1,
					1, 1, 1,
					1,-1,-1,

					-1,-1, 1,
					1,-1, 1,
					1, 1, 1,

					-1, 1, 1,
					-1,-1, 1,
					1, 1, 1,

					-1, 1,-1,
					-1, 1, 1,
					1, 1, 1,

					1, 1,-1,
					-1, 1,-1,
					1, 1, 1

				] },
				boxNormals: { type: '3fv', value: [

					1, 0, 0,
					0, 0, 1,
					0, 1, 0

				] },

			};

			this.shadowMaterial = new THREE.RawShaderMaterial( {

				uniforms: this.particleShadowUniforms,
				vertexShader: vertexShaderText,
				fragmentShader: shadowFragmentShaderText,
				side: THREE.DoubleSide,
				shading: THREE.FlatShading
			} );


			this.particles = new THREE.Mesh(geometry, this.material);
			this.particles.castShadow = true;
			this.particles.receiveShadow = true;

			this.scene.add(this.particles);


			this.initComputeRenderer();

			this.inited = true;


		}.bind(this));
	}

	this.initComputeRenderer = function() {

		var verticesPerCube = 18;

		this.gpuCompute = new GPUComputationRenderer( this.WIDTH, this.WIDTH, this.renderer );

		var dtPosition = this.gpuCompute.createTexture();
		var dtVelocity = this.gpuCompute.createTexture();
		this.fillPositionTexture( dtPosition );
		this.fillVelocityTexture( dtVelocity );

		this.velocityVariable = this.gpuCompute.addVariable( "textureVelocity", velFShaderText, dtVelocity );
		this.positionVariable = this.gpuCompute.addVariable( "texturePosition", posFShaderText, dtPosition );

		this.gpuCompute.setVariableDependencies( this.velocityVariable, [ this.positionVariable, this.velocityVariable ] );
		this.gpuCompute.setVariableDependencies( this.positionVariable, [ this.positionVariable, this.velocityVariable ] );

		this.positionUniforms = this.positionVariable.material.uniforms;
		this.velocityUniforms = this.velocityVariable.material.uniforms;

		this.positionUniforms.delta = { value: 0.0 };
		this.positionUniforms.floorPosY = { value: -100000. };
		this.positionUniforms.isReset = {value: false};
		this.positionUniforms.textureOriginPosition = {value: dtPosition};
		this.positionUniforms.interactPosition = {value: new THREE.Vector3(9999, 9999, 9999)};
		this.velocityUniforms.delta = { value: 0.0 };
		this.velocityUniforms.floorPosY = { value: -100000. };
		this.velocityUniforms.forcePos = { value: new THREE.Vector3() };
		this.velocityUniforms.forceRadius = { value: forceRadius };
		this.velocityUniforms.isReset = {value: false};
		this.velocityUniforms.timeScale = {value: timeScale};
		this.velocityUniforms.life = {value: life};
		this.velocityUniforms.evolution = {value: new THREE.Vector3()};

		this.velocityVariable.wrapS = THREE.RepeatWrapping;
		this.velocityVariable.wrapT = THREE.RepeatWrapping;
		this.positionVariable.wrapS = THREE.RepeatWrapping;
		this.positionVariable.wrapT = THREE.RepeatWrapping;

		var error = this.gpuCompute.init();
		if ( error !== null ) {
		    console.error( error );
		}


	}

	this.fillPositionTexture = function( texture ) {

		var theArray = texture.image.data;

		for ( var k = 0, kl = theArray.length; k < kl; k += 4 ) {

			var index = k / 4;

			if (index*3 >= this.positions.length)
				break;

			theArray[ k + 0 ] = this.positions[index*3];
			theArray[ k + 1 ] = this.positions[index*3+1];
			theArray[ k + 2 ] = this.positions[index*3+2];
			theArray[ k + 3 ] = -1;

		}


	}

	this.fillVelocityTexture = function( texture ) {

		var theArray = texture.image.data;

		for ( var k = 0, kl = theArray.length; k < kl; k += 4 ) {

			theArray[ k + 0 ] = 0;
			theArray[ k + 1 ] = 0;
			theArray[ k + 2 ] = 0;
			theArray[ k + 3 ] = this.life;

		}

	}

	this.addShadowedLight = function( x, y, z, color, intensity ) {

		var directionalLight = new THREE.DirectionalLight( color, intensity );
		directionalLight.position.set( x, y, z );
		this.scene.add( directionalLight );

		directionalLight.castShadow = true;

		var d = 500;
		directionalLight.shadow.camera.left = -d;
		directionalLight.shadow.camera.right = d;
		directionalLight.shadow.camera.top = d;
		directionalLight.shadow.camera.bottom = -d;

		directionalLight.shadow.camera.near = 1;
		directionalLight.shadow.camera.far = 10000;

		directionalLight.shadow.mapSize.width = this.WIDTH*2;
		directionalLight.shadow.mapSize.height = this.WIDTH*2;

		directionalLight.shadow.bias = -0.0001;

	}
	this.render = function() {
		if (!this.inited)
			return;

		// Compute 
		this.raycaster.setFromCamera( this.mouse, this.camera );
		var ray = this.raycaster.ray;
		var interactPosition = ray.at(100);
		this.positionUniforms.interactPosition.value = interactPosition;
		this.velocityUniforms.evolution.value.add(new THREE.Vector3(0.003, 0.003, 0.003));

		this.gpuCompute.compute();

		// Render shadow
		this.particleShadowUniforms.texturePosition.value = this.gpuCompute.getCurrentRenderTarget( this.positionVariable ).texture;
		this.particleShadowUniforms.textureVelocity.value = this.gpuCompute.getCurrentRenderTarget( this.velocityVariable ).texture;

		this.renderer.setClearColor( 0 );
		this.particles.material = this.shadowMaterial;
		this.renderer.render( this.scene, this.shadowCamera, this.shadowBuffer );


		// Render 
		this.particleUniforms.texturePosition.value = this.gpuCompute.getCurrentRenderTarget( this.positionVariable ).texture;
		this.particleUniforms.textureVelocity.value = this.gpuCompute.getCurrentRenderTarget( this.velocityVariable ).texture;

		this.particleUniforms.lightPosition.value.copy( this.shadowCamera.position );
		this.particleUniforms.shadowP.value.copy( this.shadowCamera.projectionMatrix );
		this.particleUniforms.shadowV.value.copy( this.shadowCamera.matrixWorldInverse );


		//this.controls.update();
		//this.camera.position.clampLength ( 100, 150 );

		this.particles.material = this.material;
		this.renderer.setClearColor( 0x000000 );
		this.renderer.render( this.scene, this.camera );


	}

	this.init();
}


function animate(time) {

	requestAnimationFrame( animate );

	TWEEN.update(time);


	logoController.render();

}

function init() {

	logoController = new LogoController(document.getElementById("logo_show_canvas"));

	document.addEventListener("touchmove", onTouchMove, false);
	document.addEventListener("touchend", onTouchEnd, false);
	document.addEventListener( 'mousemove', onMouseMove, false );

}

function onTouchMove(e) {
	e.preventDefault();
	logoController.onTouchMove(e);
}
function onTouchEnd(e) {
	//e.preventDefault();
	logoController.onTouchEnd(e);
}
function onMouseMove(e) {
	e.preventDefault();
	logoController.onMouseMove(e);
}

init();
animate();
