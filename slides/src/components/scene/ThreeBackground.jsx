import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 900;

export default function ThreeBackground({ progressRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mountNode = mountRef.current;

    if (!mountNode) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountNode.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x88c8ff, 1.1);
    const keyLight = new THREE.DirectionalLight(0x9fe7ff, 1.8);
    const rimLight = new THREE.PointLight(0x2de3b5, 10, 30, 2);
    keyLight.position.set(4, 5, 6);
    rimLight.position.set(-4, -2, 5);
    scene.add(ambientLight, keyLight, rimLight);

    const heroGroup = new THREE.Group();
    scene.add(heroGroup);

    const orbGeometry = new THREE.IcosahedronGeometry(1.7, 1);
    const orbMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x59d5ff,
      metalness: 0.08,
      roughness: 0.22,
      transparent: true,
      opacity: 0.95,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    });
    const orbMesh = new THREE.Mesh(orbGeometry, orbMaterial);
    heroGroup.add(orbMesh);

    const wireMesh = new THREE.Mesh(
      orbGeometry.clone(),
      new THREE.MeshBasicMaterial({
        color: 0x87ffe1,
        transparent: true,
        opacity: 0.16,
        wireframe: true,
      })
    );
    wireMesh.scale.setScalar(1.28);
    heroGroup.add(wireMesh);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const stride = index * 3;
      const radius = 5 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePositions[stride] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[stride + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[stride + 2] = radius * Math.cos(phi);
    }

    particlesGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particlesMaterial = new THREE.PointsMaterial({
      color: 0xd8f5ff,
      size: 0.035,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    const backgroundStart = new THREE.Color(0x04101d);
    const backgroundEnd = new THREE.Color(0x0a1430);
    const orbStart = new THREE.Color(0x59d5ff);
    const orbEnd = new THREE.Color(0x7dffd5);
    const tempColor = new THREE.Color();
    const tempOrbColor = new THREE.Color();

    scene.fog = new THREE.FogExp2(backgroundStart.clone(), 0.075);
    camera.position.set(0, 0.2, 9.5);

    let frameId = 0;
    let smoothProgress = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const renderFrame = () => {
      const elapsed = clock.getElapsedTime();
      const targetProgress = progressRef.current || 0;
      smoothProgress = THREE.MathUtils.lerp(smoothProgress, targetProgress, 0.045);

      camera.position.z = 9.5 - smoothProgress * 4.8;
      camera.position.y = 0.2 + Math.sin(smoothProgress * Math.PI) * 0.5;
      camera.lookAt(0, 0, 0);

      heroGroup.rotation.x = elapsed * 0.18 + smoothProgress * 1.25;
      heroGroup.rotation.y = elapsed * 0.28 + smoothProgress * 2.1;
      heroGroup.position.y = Math.sin(elapsed * 0.7) * 0.18;

      wireMesh.rotation.x = -elapsed * 0.12;
      wireMesh.rotation.z = elapsed * 0.08 + smoothProgress * 0.9;

      particles.rotation.y = elapsed * 0.03 + smoothProgress * 0.7;
      particles.rotation.x = elapsed * 0.015 + smoothProgress * 0.18;

      ambientLight.intensity = 1 + smoothProgress * 0.35;
      keyLight.intensity = 1.8 + smoothProgress * 0.65;
      rimLight.intensity = 10 + smoothProgress * 5;

      tempColor.copy(backgroundStart).lerp(backgroundEnd, smoothProgress);
      tempOrbColor.copy(orbStart).lerp(orbEnd, smoothProgress);
      renderer.setClearColor(tempColor, 1);
      scene.fog.color.copy(tempColor);
      orbMaterial.color.copy(tempOrbColor);

      frameId = window.requestAnimationFrame(renderFrame);
      renderer.render(scene, camera);
    };

    window.addEventListener("resize", resize);
    renderFrame();

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frameId);
      orbGeometry.dispose();
      orbMaterial.dispose();
      wireMesh.geometry.dispose();
      wireMesh.material.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      renderer.dispose();
      mountNode.removeChild(renderer.domElement);
    };
  }, [progressRef]);

  return <div ref={mountRef} className="three-scene-shell" aria-hidden="true" />;
}
