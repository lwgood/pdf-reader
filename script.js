// PDF.js配置
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 全局变量
let pdfDocument = null;
let currentPageNum = 1;
let scale = 1;
let rotationAngle = 0;
let isRendering = false;
let renderQueue = null;

// DOM元素
const dom = {
    pdfInput: document.getElementById('pdf-input'),
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    zoomOutBtn: document.getElementById('zoom-out'),
    zoomInBtn: document.getElementById('zoom-in'),
    zoomPercent: document.getElementById('zoom-percent'),
    rotateBtn: document.getElementById('rotate'),
    fitWidthBtn: document.getElementById('fit-width'),
    currentPageEl: document.getElementById('current-page'),
    totalPagesEl: document.getElementById('total-pages'),
    emptyState: document.getElementById('empty-state'),
    pdfContainer: document.getElementById('pdf-container'),
    pdfCanvas: document.getElementById('pdf-canvas'),
    pdfContext: document.getElementById('pdf-canvas').getContext('2d')
};

// 更新缩放显示
function updateZoomDisplay() {
    dom.zoomPercent.textContent = `${Math.round(scale * 100)}%`;
}

// 渲染PDF页面
async function renderPage() {
    if (isRendering || !pdfDocument) return;
    
    isRendering = true;
    
    try {
        const page = await pdfDocument.getPage(currentPageNum);
        const viewport = page.getViewport({ scale: 1, rotation: rotationAngle });
        
        // 计算缩放后的尺寸
        const scaledWidth = viewport.width * scale;
        const scaledHeight = viewport.height * scale;
        
        // 设置Canvas尺寸
        const devicePixelRatio = window.devicePixelRatio || 1;
        dom.pdfCanvas.width = scaledWidth * devicePixelRatio;
        dom.pdfCanvas.height = scaledHeight * devicePixelRatio;
        dom.pdfCanvas.style.width = `${scaledWidth}px`;
        dom.pdfCanvas.style.height = `${scaledHeight}px`;
        
        // 显示PDF容器
        dom.emptyState.style.display = 'none';
        dom.pdfContainer.style.display = 'block';
        
        // 创建渲染上下文
        const renderContext = {
            canvasContext: dom.pdfContext,
            viewport: page.getViewport({ 
                scale: scale * devicePixelRatio,
                rotation: rotationAngle 
            })
        };
        
        // 清空画布
        dom.pdfContext.clearRect(0, 0, dom.pdfCanvas.width, dom.pdfCanvas.height);
        
        // 渲染页面
        await page.render(renderContext).promise;
        
        // 更新页面显示
        dom.currentPageEl.textContent = currentPageNum;
        dom.totalPagesEl.textContent = pdfDocument.numPages;
        
    } catch (error) {
        console.error('渲染错误:', error);
    } finally {
        isRendering = false;
        
        // 执行渲染队列
        if (renderQueue) {
            const nextRender = renderQueue;
            renderQueue = null;
            nextRender();
        }
    }
}

// 加载PDF文件
function loadPDF(file) {
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
        try {
            // 清除之前的PDF文档
            if (pdfDocument) {
                pdfDocument.destroy();
            }
            
            // 加载新PDF
            const typedArray = new Uint8Array(this.result);
            pdfDocument = await pdfjsLib.getDocument(typedArray).promise;
            
            // 重置状态
            currentPageNum = 1;
            scale = 1;
            rotationAngle = 0;
            updateZoomDisplay();
            
            // 渲染第一页
            await renderPage();
            
        } catch (error) {
            console.error('加载PDF错误:', error);
            dom.emptyState.style.display = 'flex';
            dom.pdfContainer.style.display = 'none';
        }
    };
    
    fileReader.onerror = function() {
        console.error('文件读取错误');
    };
    
    fileReader.readAsArrayBuffer(file);
}

// 设置事件监听器
function setupEventListeners() {
    // 文件选择
    dom.pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadPDF(e.target.files[0]);
        }
    });
    
    // 上一页
    dom.prevPageBtn.addEventListener('click', () => {
        if (pdfDocument && currentPageNum > 1) {
            currentPageNum--;
            if (isRendering) {
                renderQueue = renderPage;
                return;
            }
            renderPage();
        }
    });
    
    // 下一页
    dom.nextPageBtn.addEventListener('click', () => {
        if (pdfDocument && currentPageNum < pdfDocument.numPages) {
            currentPageNum++;
            if (isRendering) {
                renderQueue = renderPage;
                return;
            }
            renderPage();
        }
    });
    
    // 缩小
    dom.zoomOutBtn.addEventListener('click', () => {
        const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
        let newScale = scale;
        
        for (let i = zoomSteps.length - 1; i >= 0; i--) {
            if (zoomSteps[i] < scale) {
                newScale = zoomSteps[i];
                break;
            }
        }
        
        if (newScale !== scale) {
            scale = newScale;
            updateZoomDisplay();
            if (isRendering) {
                renderQueue = renderPage;
                return;
            }
            renderPage();
        }
    });
    
    // 放大
    dom.zoomInBtn.addEventListener('click', () => {
        const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
        let newScale = scale;
        
        for (let i = 0; i < zoomSteps.length; i++) {
            if (zoomSteps[i] > scale) {
                newScale = zoomSteps[i];
                break;
            }
        }
        
        if (newScale !== scale) {
            scale = newScale;
            updateZoomDisplay();
            if (isRendering) {
                renderQueue = renderPage;
                return;
            }
            renderPage();
        }
    });
    
    // 旋转
    dom.rotateBtn.addEventListener('click', () => {
        rotationAngle = (rotationAngle + 90) % 360;
        if (isRendering) {
            renderQueue = renderPage;
            return;
        }
        renderPage();
    });
    
    // 适应宽度
    dom.fitWidthBtn.addEventListener('click', async () => {
        if (!pdfDocument) return;
        
        try {
            const page = await pdfDocument.getPage(currentPageNum);
            const viewport = page.getViewport({ scale: 1, rotation: rotationAngle });
            const containerWidth = dom.pdfContainer.clientWidth - 40;
            scale = containerWidth / viewport.width;
            
            // 找到最接近的标准缩放比例
            const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
            let closestScale = zoomSteps[0];
            let minDiff = Math.abs(scale - zoomSteps[0]);
            
            for (let i = 1; i < zoomSteps.length; i++) {
                const diff = Math.abs(scale - zoomSteps[i]);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestScale = zoomSteps[i];
                }
            }
            
            scale = closestScale;
            updateZoomDisplay();
            if (isRendering) {
                renderQueue = renderPage;
                return;
            }
            renderPage();
        } catch (error) {
            console.error('适应宽度错误:', error);
        }
    });
    
    // 拖放支持
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type === 'application/pdf') {
            loadPDF(e.dataTransfer.files[0]);
        }
    });
    
    // 键盘导航
    document.addEventListener('keydown', (e) => {
        if (!pdfDocument) return;
        
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                if (currentPageNum > 1) {
                    currentPageNum--;
                    if (isRendering) {
                        renderQueue = renderPage;
                        return;
                    }
                    renderPage();
                    e.preventDefault();
                }
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                if (currentPageNum < pdfDocument.numPages) {
                    currentPageNum++;
                    if (isRendering) {
                        renderQueue = renderPage;
                        return;
                    }
                    renderPage();
                    e.preventDefault();
                }
                break;
        }
    });
    
    // 窗口大小变化
    window.addEventListener('resize', () => {
        if (pdfDocument) {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => {
                if (isRendering) {
                    renderQueue = renderPage;
                    return;
                }
                renderPage();
            }, 250);
        }
    });
}

// 初始化应用
function initialize() {
    setupEventListeners();
    dom.emptyState.style.display = 'flex';
    dom.pdfContainer.style.display = 'none';
    updateZoomDisplay();
}

// 页面加载完成后初始化
window.addEventListener('load', initialize);