var renderer, scene, camera, mapCamera;
var cameraControls;
var globo, helice;
var playerIndicator; 

var composer, water, bloomPass;
var guiControls;

var moveAdelante = false, moveAtras = false, moveIzquierda = false, moveDerecha = false, moveArriba = false, moveAbajo = false;

var flameGroup, flameMesh, flameLight;
var smokeParticles = [];

var globoColliderVisual; 
const RADIO_GLOBO = 25;  
const RADIO_ARO = 35;    

var velocity = { x: 0, y: 0, z: 0 };
var friccion = 0.94; 
var aceleracion = 0.08; 
var windAngle = 0;

var heightData = null;
var imgW, imgH;
const displacementScale = 120;
const MAP_SIZE = 3000; 

var puntos = 0; 
var aros = [];
var soundBurner, soundWind;
var stats; 

var juegoIniciado = false; 
var juegoTerminado = false; 

init();
loadScene();
render();

function init() {
    THREE.DefaultLoadingManager.onLoad = function () {
        const btnPlay = document.getElementById('btnPlay');
        btnPlay.innerText = "JUGAR";
        btnPlay.disabled = false;
        btnPlay.style.backgroundColor = "#00aa00"; 
        btnPlay.style.cursor = "pointer";
        
        btnPlay.addEventListener('click', function() {
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('hud').style.display = 'block';
            
            cameraControls.autoRotate = false;
            
            if (THREE.AudioContext && THREE.AudioContext.getContext().state === 'suspended') {
                THREE.AudioContext.getContext().resume();
            }
            if (soundWind && soundWind.buffer && !soundWind.isPlaying) soundWind.play();
            
            juegoIniciado = true;
        });
    };

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.autoClear = false; 
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xd8e7ff);
    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd8e7ff, 800, 2800);

    var aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(50, aspectRatio, 1, 10000);
    camera.position.set(0, 500, 1000);
    camera.layers.disable(1); 

    mapCamera = new THREE.OrthographicCamera(-400, 400, 400, -400, 1, 2000);
    mapCamera.position.set(0, 1000, 0);
    mapCamera.lookAt(0, 0, 0);
    mapCamera.layers.enable(1); 

    cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
    cameraControls.enableDamping = true;
    cameraControls.dampingFactor = 0.05;
    cameraControls.target.set(0, 150, 0);
    cameraControls.maxPolarAngle = Math.PI / 2.05; 
    cameraControls.minPolarAngle = 0; 
    cameraControls.autoRotate = true;
    cameraControls.autoRotateSpeed = 1.0;
    
    cameraControls.maxDistance = 2500; 
    cameraControls.minDistance = 200;  

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x442222, 0.8);
    scene.add(hemiLight);
    
    const directionalLight = new THREE.DirectionalLight(0xfffacd, 2.0);
    directionalLight.position.set(4000, 1200, 2000); 
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -2000;
    directionalLight.shadow.camera.right = 2000;
    directionalLight.shadow.camera.top = 2000;
    directionalLight.shadow.camera.bottom = -2000;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 8000; 
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const sunGroup = new THREE.Group();
    sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(250, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })));
    sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(450, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.3, fog: false })));
    sunGroup.position.copy(directionalLight.position);
    scene.add(sunGroup);

    const renderScene = new THREE.RenderPass(scene, camera);
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 1.0;  
    bloomPass.strength = 0.2;  
    bloomPass.radius = 0.1;    

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    if (typeof Stats !== 'undefined') {
        stats = new Stats();
        stats.showPanel(0);
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '20px';
        stats.domElement.style.left = '280px'; 
        stats.domElement.style.right = 'auto'; 
        stats.domElement.style.zIndex = '9999';
        document.body.appendChild(stats.domElement);
    }

    guiControls = {
        acel: 0.08,
        fricc: 0.94,
        fuerzaViento: 0.005,
        debugColisiones: false 
    };

    if (typeof dat !== 'undefined') {
        const gui = new dat.GUI({ width: 300, autoPlace: false });
        gui.domElement.style.position = 'absolute';
        gui.domElement.style.top = '250px'; 
        gui.domElement.style.left = '20px'; 
        gui.domElement.style.zIndex = '9999';
        document.body.appendChild(gui.domElement);
        
        const folderFisicas = gui.addFolder('Físicas y Colisiones');
        folderFisicas.add(guiControls, 'acel', 0.01, 0.3).name('Aceleración Motor').onChange(v => aceleracion = v);
        folderFisicas.add(guiControls, 'fricc', 0.8, 0.99).name('Resistencia Aire').onChange(v => friccion = v);
        folderFisicas.add(guiControls, 'fuerzaViento', 0.0, 0.03).name('Velocidad Viento');
        folderFisicas.add(guiControls, 'debugColisiones').name('Ver Colisiones (Debug)'); 

        const folderEfectos = gui.addFolder('Efectos Visuales (Bloom)');
        folderEfectos.add(bloomPass, 'strength', 0.0, 3.0).name('Intensidad de Brillo');
        folderEfectos.add(bloomPass, 'threshold', 0.0, 1.0).name('Umbral (Filtro)');

        const folderEntorno = gui.addFolder('Entorno');
        folderEntorno.add(directionalLight, 'intensity', 0.0, 5.0).name('Intensidad Sol');
        folderEntorno.add(scene.fog, 'far', 1000, 5000).name('Distancia Niebla');
        
        gui.close();
    }

    playerIndicator = new THREE.Mesh(
        new THREE.SphereGeometry(25, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    playerIndicator.layers.set(1); 
    scene.add(playerIndicator);

    globoColliderVisual = new THREE.Mesh(
        new THREE.SphereGeometry(RADIO_GLOBO, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    );
    globoColliderVisual.visible = false; 
    scene.add(globoColliderVisual);

    const listener = new THREE.AudioListener();
    camera.add(listener);

    soundBurner = new THREE.PositionalAudio(listener);
    soundWind = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('assets/blowtorch.mp3', function(buffer) {
        soundBurner.setBuffer(buffer);
        soundBurner.setRefDistance(500);
        soundBurner.setLoop(true);
    });
    audioLoader.load('assets/wind.mp3', function(buffer) {
        soundWind.setBuffer(buffer);
        soundWind.setLoop(true);
        soundWind.setVolume(0.2);
    });

    window.addEventListener('resize', updateAspectRatio);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
}

function loadScene() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/sky.jpg', function(texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
    });

    const heightmapTexture = textureLoader.load('assets/heihtmap.png');
    const colorTexture = textureLoader.load('assets/textura.png');

    [heightmapTexture, colorTexture].forEach(tex => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
    });

    const planeGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 512, 512);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshStandardMaterial({
        map: colorTexture,
        displacementMap: heightmapTexture,
        displacementScale: displacementScale,
        roughness: 1
    });

    const terreno = new THREE.Mesh(planeGeo, planeMat);
    terreno.receiveShadow = true;
    scene.add(terreno);

    const waterGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0055aa, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.8
    });
    water = new THREE.Mesh(waterGeo, waterMat);
    water.rotateX(-Math.PI / 2);
    water.position.y = 8; 
    scene.add(water);

    const aroGeo = new THREE.TorusGeometry(RADIO_ARO, 2, 16, 40);
    const aroMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 1.0 }); 
    for (let i = 0; i < 10; i++) {
        const aro = new THREE.Mesh(aroGeo, aroMat);
        aro.userData = { baseY: 150 + Math.random() * 400, offset: Math.random() * Math.PI * 2 };
        aro.position.set((Math.random()-0.5)*2200, aro.userData.baseY, (Math.random()-0.5)*2200);
        aro.rotation.y = Math.random() * Math.PI;
        aro.castShadow = true;
        scene.add(aro);
        
        const aroColliderVisual = new THREE.Mesh(
            new THREE.SphereGeometry(RADIO_ARO + 2, 16, 16), 
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        );
        aroColliderVisual.visible = false;
        scene.add(aroColliderVisual);
        
        aro.userData.colliderVisual = aroColliderVisual;
        aros.push(aro);
    }

    const img = new Image();
    img.src = 'assets/heihtmap.png';
    img.onload = function() {
        imgW = img.width; imgH = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = imgW; canvas.height = imgH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        heightData = ctx.getImageData(0, 0, imgW, imgH).data;

        const treeCount = 150;
        const trunkGeo = new THREE.CylinderGeometry(2, 3, 15, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d2600 });
        const leafGeo = new THREE.ConeGeometry(12, 35, 8);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x224422 });

        for (let i = 0; i < treeCount; i++) {
            const x = (Math.random() - 0.5) * (MAP_SIZE - 200);
            const z = (Math.random() - 0.5) * (MAP_SIZE - 200);
            let u = Math.floor((((x + MAP_SIZE/2) % (MAP_SIZE/2)) / (MAP_SIZE/2)) * imgW);
            let v = Math.floor((((z + MAP_SIZE/2) % (MAP_SIZE/2)) / (MAP_SIZE/2)) * imgH);
            let pixelIndex = (Math.abs(v) * imgW + Math.abs(u)) * 4;
            let h = (heightData[pixelIndex] / 255) * displacementScale;
            if (h > 12) {
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 7.5;
                const leaves = new THREE.Mesh(leafGeo, leafMat); leaves.position.y = 25;
                trunk.castShadow = true; leaves.castShadow = true;
                tree.add(trunk); tree.add(leaves);
                tree.position.set(x, h, z);
                scene.add(tree);
            }
        }
    };

    const gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load('assets/hot_air_balloon.glb', function(gltf) {
        globo = gltf.scene;
        globo.traverse(node => { if(node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });

        const motorGeo = new THREE.CylinderGeometry(20, 20, 40, 16);
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const motor = new THREE.Mesh(motorGeo, motorMat);
        motor.position.set(0, 40, 110); motor.rotateX(Math.PI / 2);
        motor.castShadow = true;
        
        const aspaGeo = new THREE.BoxGeometry(100, 8, 4);
        const aspaMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        helice = new THREE.Mesh(aspaGeo, aspaMat);
        helice.position.set(0, 25, 0);
        helice.castShadow = true;
        motor.add(helice);
        globo.add(motor);

        flameGroup = new THREE.Group();
        const flameGeo = new THREE.ConeGeometry(50, 180, 16, 1, true);
        flameGeo.rotateX(Math.PI);
        const flameMat = new THREE.MeshStandardMaterial({ 
            color: 0xff6600, emissive: 0xffaa00, emissiveIntensity: 2.0, transparent: true, opacity: 0.8, side: THREE.DoubleSide 
        });
        
        flameMesh = new THREE.Mesh(flameGeo, flameMat);
        flameGroup.add(flameMesh);

        flameLight = new THREE.PointLight(0xffaa00, 1.5, 300, 2);
        flameGroup.add(flameLight);
        flameGroup.position.set(0, 350, 0);
        flameMesh.visible = false; flameLight.visible = false;
        globo.add(flameGroup);

        if (soundBurner) globo.add(soundBurner);
        
        globo.position.set(0, 350, 0);
        globo.scale.set(0.12, 0.12, 0.12);
        scene.add(globo);
    });
}

function onKeyDown(event) {
    switch(event.key.toLowerCase()) {
        case 'w': case 'arrowup': moveAdelante = true; break;
        case 's': case 'arrowdown': moveAtras = true; break;
        case 'a': case 'arrowleft': moveIzquierda = true; break;
        case 'd': case 'arrowright': moveDerecha = true; break;
        case 'q': moveArriba = true; break;
        case 'e': moveAbajo = true; break;
    }
}

function onKeyUp(event) {
    switch(event.key.toLowerCase()) {
        case 'w': case 'arrowup': moveAdelante = false; break;
        case 's': case 'arrowdown': moveAtras = false; break;
        case 'a': case 'arrowleft': moveIzquierda = false; break;
        case 'd': case 'arrowright': moveDerecha = false; break;
        case 'q': moveArriba = false; break;
        case 'e': moveAbajo = false; break;
    }
}

function crearParticulaHumo() {
    const geo = new THREE.SphereGeometry(12, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.3 });
    const p = new THREE.Mesh(geo, mat);
    const pos = new THREE.Vector3();
    flameGroup.getWorldPosition(pos);
    p.position.copy(pos);
    p.userData = { vx: (Math.random() - 0.5) * 0.4, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 0.4, vida: 1.0 };
    scene.add(p);
    smokeParticles.push(p);
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    composer.setSize(window.innerWidth, window.innerHeight); 
}

function updateHUD(windStrength) {
    if (!globo) return;
    document.getElementById('altitud').innerText = Math.round(globo.position.y);
    let horizSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) * 20;
    document.getElementById('velocidad').innerText = Math.round(horizSpeed);
    document.getElementById('velVert').innerText = (velocity.y * 10).toFixed(1);
    document.getElementById('vientoVal').innerText = Math.round(windStrength * 400);
    let dir = (windAngle > -0.78 && windAngle <= 0.78) ? "E" : (windAngle > 0.78 && windAngle <= 2.35) ? "S" : (windAngle > 2.35 || windAngle <= -2.35) ? "O" : "N";
    document.getElementById('vientoDir').innerText = dir;
}

function update() {
    cameraControls.update();
    if (globo) {
        
        if (puntos >= 10 && !juegoTerminado) {
            juegoTerminado = true;
            
            document.getElementById('hud').innerHTML = `
                <div style="text-align: center; background: rgba(0,255,0,0.2); padding: 20px; border-radius: 10px; border: 2px solid #00ff00;">
                    <h1 style="color: #00ff00; margin: 0; text-shadow: 0 0 10px #00ff00;">¡MISIÓN COMPLETADA!</h1>
                    <p style="color: white; margin-top: 10px;">Has recogido todos los aros.</p>
                </div>
            `;
            
            cameraControls.autoRotate = true;
            cameraControls.autoRotateSpeed = 2.0; 
            
            if (soundBurner && soundBurner.isPlaying) soundBurner.stop();
            if (flameMesh) { flameMesh.visible = false; flameLight.visible = false; }
        }

        if (juegoIniciado && !juegoTerminado) {
            if (moveAdelante) velocity.z -= aceleracion;
            if (moveAtras) velocity.z += aceleracion;
            if (moveIzquierda) velocity.x -= aceleracion;
            if (moveDerecha) velocity.x += aceleracion;
            
            if (moveArriba) {
                velocity.y += aceleracion;
                if (flameMesh) {
                    flameMesh.visible = true; flameLight.visible = true;
                    flameMesh.scale.y = 1.0 + Math.sin(Date.now() * 0.05) * 0.1;
                    if (Math.random() > 0.8) crearParticulaHumo();
                    if (soundBurner && soundBurner.buffer && !soundBurner.isPlaying) soundBurner.play();
                }
            } else {
                if (flameMesh) { flameMesh.visible = false; flameLight.visible = false; }
                if (soundBurner && soundBurner.isPlaying) soundBurner.stop();
            }
            if (moveAbajo) velocity.y -= aceleracion;
        }

        let force = 0;

        if (juegoIniciado) {
            windAngle += 0.001; 
            force = (Math.sin(Date.now() * 0.0003) + 1.0) * guiControls.fuerzaViento; 
            
            if (juegoTerminado) {
                force *= 0.1; 
                friccion = 0.98; 
            }

            velocity.x += Math.cos(windAngle) * force;
            velocity.z += Math.sin(windAngle) * force;

            const MAX_TILT = 0.35; 
            globo.rotation.z = Math.max(-MAX_TILT, Math.min(MAX_TILT, velocity.x * -0.5));
            globo.rotation.x = Math.max(-MAX_TILT, Math.min(MAX_TILT, velocity.z * 0.5));
        }

        globo.position.x += velocity.x;
        globo.position.y += velocity.y;
        globo.position.z += velocity.z;
        velocity.x *= friccion; velocity.y *= friccion; velocity.z *= friccion;

        if (mapCamera && playerIndicator) {
            mapCamera.position.x = globo.position.x;
            mapCamera.position.z = globo.position.z;
            playerIndicator.position.set(globo.position.x, globo.position.y + 150, globo.position.z);
        }

        if (heightData) {
            let u = Math.floor((((globo.position.x + MAP_SIZE/2) % (MAP_SIZE/2)) / (MAP_SIZE/2)) * imgW);
            let v = Math.floor((((globo.position.z + MAP_SIZE/2) % (MAP_SIZE/2)) / (MAP_SIZE/2)) * imgH);
            let pixelIndex = (Math.abs(v) * imgW + Math.abs(u)) * 4;
            let groundH = (heightData[pixelIndex] / 255) * displacementScale;
            if (globo.position.y < groundH + 5) {
                globo.position.y = groundH + 5;
                velocity.y = 0;
            }
        }

        if (globoColliderVisual) {
            globoColliderVisual.position.set(globo.position.x, globo.position.y + 15, globo.position.z);
            globoColliderVisual.visible = guiControls.debugColisiones;
        }
        const globoSphere = new THREE.Sphere(globoColliderVisual ? globoColliderVisual.position : globo.position, RADIO_GLOBO);

        aros.forEach((aro) => {
            if (aro.visible) {
                aro.rotation.y += 0.02; 
                aro.position.y = aro.userData.baseY + Math.sin(Date.now() * 0.002 + aro.userData.offset) * 10;

                aro.userData.colliderVisual.position.copy(aro.position);
                aro.userData.colliderVisual.visible = guiControls.debugColisiones;

                const aroSphere = new THREE.Sphere(aro.position, RADIO_ARO + 2);

                if (globoSphere.intersectsSphere(aroSphere)) {
                    aro.visible = false;
                    aro.userData.colliderVisual.visible = false;
                    puntos++;
                    if (!juegoTerminado && juegoIniciado) document.getElementById('puntos').innerText = puntos;
                }
            } else {
                aro.userData.colliderVisual.visible = false;
            }
        });

        if (water) water.position.y = 8 + Math.sin(Date.now() * 0.001) * 0.5;

        for (let i = smokeParticles.length - 1; i >= 0; i--) {
            let p = smokeParticles[i];
            p.position.x += p.userData.vx; p.position.y += p.userData.vy; p.position.z += p.userData.vz;
            p.scale.addScalar(0.04); 
            p.userData.vida -= 0.015; p.material.opacity = p.userData.vida * 0.3;
            if (p.userData.vida <= 0) { scene.remove(p); smokeParticles.splice(i, 1); }
        }

        if (helice && Math.abs(velocity.x + velocity.z) > 0.05) {
            helice.rotation.y += 0.4;
        }
        
        if (!juegoTerminado && juegoIniciado) updateHUD(force);
        cameraControls.target.copy(globo.position);
    }
}

function render() {
    requestAnimationFrame(render);
    update();
    
    renderer.clear();

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    composer.render(); 

    if (mapCamera && juegoIniciado) {
        const size = 200; 
        const margin = 20; 
        
        const mapX = window.innerWidth - size - margin;
        const mapY = window.innerHeight - size - margin; 
        
        renderer.setViewport(mapX, mapY, size, size);
        renderer.setScissor(mapX, mapY, size, size);
        renderer.setScissorTest(true);
        
        renderer.clearDepth(); 
        renderer.render(scene, mapCamera);
        renderer.setScissorTest(false);
    }
    
    if (typeof stats !== 'undefined') {
        stats.domElement.style.display = juegoIniciado ? 'block' : 'none';
        stats.update(); 
    }
}
