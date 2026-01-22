const dropArea = document.getElementById('drop-area');
const statusDiv = document.getElementById('status');
const fileListDiv = document.getElementById('file-list');
const fileCountDiv = document.getElementById('file-count');
const fileInput = document.getElementById('fileElem');
const uploadBtn = document.getElementById('uploadBtn');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

// Highlight drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
});

// Handle dropped files
dropArea.addEventListener('drop', handleDrop, false);
dropArea.addEventListener('click', () => fileInput.click(), false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Handle selected files from input
if (fileInput) {
    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        handleFiles(files);
    });
}

function handleFiles(files) {
    if (files.length > 0) {
        fileListDiv.innerHTML = ''; // Clear previous list
        fileCountDiv.textContent = `Total files: ${files.length}`;

        // Populate inputs
        Array.from(files).forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="file-status">
                    ✅ Ready
                </span>
            `;
            fileListDiv.appendChild(fileItem);
        });

        // Store files for upload
        uploadBtn.filesToUpload = files;

        // Show Upload Button with animation
        uploadBtn.style.display = 'inline-block';
        uploadBtn.classList.add('fade-in');
    }
}

// Upload Logic
if (uploadBtn) {
    uploadBtn.addEventListener('click', uploadFiles);
}

async function uploadFiles() {
    // Prefer files from drop/store, else input
    let files = uploadBtn.filesToUpload || fileInput.files;

    if (!files || files.length === 0) {
        statusDiv.textContent = 'Please select at least one file.';
        statusDiv.className = 'status error';
        return;
    }

    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '🕒 Đang xử lý... Vui lòng đợi trong giây lát (khoảng 10-30s)...';
    statusDiv.className = 'status processing';
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '⏳ Processing...';

    const formData = new FormData();
    const reportTitle = document.getElementById('reportTitle').value;
    const deviceType = document.getElementById('deviceType').value;
    formData.append('reportTitle', reportTitle);
    formData.append('deviceType', deviceType);

    // Note: 'files' object might not match DOM inputs order if not careful, but usually it does.
    Array.from(files).forEach((file, index) => {
        formData.append('files', file);
    });

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Extract filename from header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'Testo_Report.pdf';
            if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            statusDiv.innerHTML = '✅ Tạo báo cáo thành công! Tải xuống đang bắt đầu.';
            statusDiv.className = 'status success';
        } else {
            const errorText = await response.text();
            statusDiv.innerHTML = '❌ Lỗi server: ' + errorText;
            statusDiv.className = 'status error';
        }
    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = '❌ Lỗi kết nối: Không thể gửi yêu cầu lên server.';
        statusDiv.className = 'status error';
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = 'Generate PV Report'; // Reset text
        uploadBtn.filesToUpload = null; // Reset
    }
}
