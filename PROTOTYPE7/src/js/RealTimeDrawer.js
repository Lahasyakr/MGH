class RealTimeDrawer {
    constructor(viewer) {
        this.nv = viewer.nv; // NiiVue object
        this.viewer = viewer;
        this.prevColor = 1; // previous selected color
        this.setUpInteraction();
        this.setupDrawOpacity();
        this.currentDrawData = [];
        this.isFilled = false;
        this.last_drawing = [];
        this.position = null;
        this.isNewUser = true;
        this.isDrawing = false; // drawing flag
        this.isErasing = false; // erasing flag
    }
}

// initial setup when opening website
RealTimeDrawer.prototype.setUpInteraction = function () {
    this.nv.onLocationChange = function (e) {
        this.position = e['vox'];
    }.bind(this);

    const element = document.getElementById('viewer');
    element.onmousemove = this.onMouseMove.bind(this);
    element.onmouseup = this.onMouseUp.bind(this);
    element.onkeydown = this.onKeyDown.bind(this);
    element.onwheel = this.onWheel.bind(this);

    this.connect();

    let nvobj = this.nv;
    nvobj.setPenValue(1, this.isFilled); // initializing for color red

    $(".colorPickSelector").colorPick({
        'initialColor': "#FF0000", // initial color in pallete
        'onColorSelected': function () {
            this.element.css({ 'backgroundColor': this.color, 'color': this.color });
            nvobj.setPenValue(colorlist[this.color], this.isFilled); // setting color value
        }
    });
}

RealTimeDrawer.prototype.setupDrawOpacity = function () {
    this.nv.drawOpacity = 0.8;
    this.opacityWrapper = document.getElementById("currentOpacity");
    this.opacityLabel = this.opacityWrapper.children.namedItem("opacityLabel");

    this.opacityLabel.innerHTML = this.nv.drawOpacity;
    this.opacitySlider = this.opacityWrapper.children.namedItem("opacitySlider");

    this.opacitySlider.oninput = (e) => {
        this.nv.drawOpacity = e.target.value;
        this.opacityLabel.innerHTML = this.nv.drawOpacity;
    }

    this.opacitySlider.onchange = (e) => {
        this.nv.updateGLVolume();
    }
}

RealTimeDrawer.prototype.onMouseMove = function (e) {
    if (this.isFilled) {
        this.draw()
    } 
    else if (e.buttons && this.nv.opts.drawingEnabled && this.position && this.position.length > 0) {
        let pt = [this.position[0], this.position[1], this.position[2]]
        this.last_drawing.push(pt)
    }

    if (this.nv.opts.penValue > 0) {
        this.prevColor = this.nv.opts.penValue;
    }
};

RealTimeDrawer.prototype.onMouseUp = function (e) {
    this.nv.refreshDrawing();
    this.position = [];
    if (this.nv.opts.penValue >= 0 && this.nv.opts.drawingEnabled && this.last_drawing.length > 0) {
        let shareObj = { 'isFilled': this.isFilled, 'drawing': this.last_drawing, 'label': this.nv.opts.penValue };
        this.currentDrawData.push(shareObj);
        // send via pusher
        LINK.trigger('client-receive', shareObj);
    }
    this.last_drawing = [];
};

RealTimeDrawer.prototype.onWheel = function (m) {
    var u = this.nv.canvas.getBoundingClientRect();
    var data = {
        "mouse_args": { "deltaY": m.deltaY, "clientX": m.clientX, "clientY": m.clientY },
        "canvas_info": { "left": u.left, "top": u.top }
    }
    LINK.trigger('client-receive-wheel', { "data": data });
}

RealTimeDrawer.prototype.onKeyDown = function (e) {
    // Hotkeys
    // D - Toggle Drawing Tool
    if (e.keyCode == 68) {
        this.enable_disable_Drawing();
    }
    // Space - Cycle Image Perspective
    else if (e.code == 'Space') {
        this.viewer.changeView()

        // view sync (it is turned on by default)
        LINK.trigger('client-set-slicetype', { 'view_number': this.viewer.view });
    }
    // Ctrl + Z - Undo Previous Annotation
    else if (e.keyCode == 90 && e.ctrlKey) {
        this.nv.drawUndo();
        this.currentDrawData.pop()
        LINK.trigger('client-undo', {});
    }
    // Ctrl + Y - Save Drawing as .nvd (Medical Volume + Annotations)
    else if (e.keyCode == 89 && e.ctrlKey) {
        this.saveDrawing()
    }
    // Ctrl + B - Save Drawing as .png (Current Image Slice + Annotations)
    else if (e.keyCode == 66 && e.ctrlKey) {
        e.preventDefault();
        this.saveScreenshot()
    }
    // E - Toggle Erase Tool
    else if (e.keyCode == 69) {
        this.enable_disable_Erasing();
    }
    // 1 - Zoom Mode
    else if (e.keyCode == 49) {
        this.nv.opts.dragMode = this.nv.dragModes.pan;
    }
    // 2 - Measurement Mode
    else if (e.keyCode == 50) {
        this.nv.opts.dragMode = this.nv.dragModes.measurement;
    }
    // 3 - Slice Cycle Mode
    else if (e.keyCode == 51) {
        this.nv.opts.dragMode = this.nv.dragModes.none;
    }

    this.nv.updateGLVolume()
}


RealTimeDrawer.prototype.enable_disable_Drawing = function () {
    this.toggleDrawing = document.getElementById("toggleDrawing");
    this.toggleErasing = document.getElementById("toggleErasing");

    // toggle drawing
    this.isDrawing = !this.isDrawing;

    if (this.isDrawing) {
        this.nv.setDrawingEnabled(true);

        // selects the color previously chosen
        if (this.nv.opts.penValue == 0) {
            this.nv.setPenValue(this.prevColor);
        }

        this.toggleDrawing.innerHTML = "Enabled";

        this.isErasing = false;
        this.toggleErasing.innerHTML = "Disabled";
    }
    else {
        this.nv.setDrawingEnabled(false);

        this.toggleDrawing.innerHTML = "Disabled";
    }
}

RealTimeDrawer.prototype.enable_disable_Erasing = function () {
    this.toggleDrawing = document.getElementById("toggleDrawing");
    this.toggleErasing = document.getElementById("toggleErasing");

    // toggle erasing
    this.isErasing = !this.isErasing;

    if (this.isErasing) {
        this.nv.setDrawingEnabled(true)
        this.nv.setPenValue(0);

        this.toggleErasing.innerHTML = "Enabled";

        this.isDrawing = false;
        this.toggleDrawing.innerHTML = "Disabled";
    }
    else {
        this.nv.setDrawingEnabled(false);

        this.toggleErasing.innerHTML = "Disabled";
    }
}

RealTimeDrawer.prototype.saveDrawing = function () {
    var filenameWithExtension = this.viewer.data[0].url.split('/').pop(); // "visiblehuman.nii.gz"
    var filenameWithoutExtension = filenameWithExtension.split('.').shift(); // "visiblehuman"

    //this.nv.saveImage("draw.nii", true);
    this.nv.saveDocument(filenameWithoutExtension + ".drawing.nvd");
};

RealTimeDrawer.prototype.saveScreenshot = function () {
    var filenameWithExtension = this.viewer.data[0].url.split('/').pop(); // "visiblehuman.nii.gz"
    var filenameWithoutExtension = filenameWithExtension.split('.').shift(); // "visiblehuman"

    this.nv.saveScene(filenameWithoutExtension + ".png")
};

RealTimeDrawer.prototype.draw = function () {
    //console.log(nv.drawPenFillPts)
    if (this.nv.drawPenFillPts.length > 0) {
        this.last_drawing = this.nv.drawPenFillPts;
    }

};

RealTimeDrawer.prototype.drawAnnotation = function (ptA, ptB, label, nv) {
    if (!nv.opts.drawingEnabled) {
        nv.setDrawingEnabled(true);
    }
    //nv.setDrawingEnabled(false);

    nv.drawPenLine(ptA, ptB, label);
    console.log(nv.drawPenFillPts)
    nv.refreshDrawing(true);
}

RealTimeDrawer.prototype.drawOnPusherTrigger = function (data, currentThis) {
    let startPt = [data['drawing'][0][0], data['drawing'][0][1], data['drawing'][0][2]]
    let constStartpt = startPt;
    let value = data['label'];
    for (var i = 1; i < data['drawing'].length; i++) {

        let x = data['drawing'][i][0];
        let y = data['drawing'][i][1];
        let z = data['drawing'][i][2];
        var endpoint = [x, y, z]
        currentThis.drawAnnotation(startPt, endpoint, value, currentThis.nv)
        startPt = endpoint;
        currentThis.nv.refreshDrawing(true);
    }
    //connecting the first and last point
    if (data['isFilled']) { currentThis.drawFilled(constStartpt, endpoint, value, currentThis.nv); }

    currentThis.nv.drawAddUndoBitmap();
    currentThis.currentDrawData.push(data)

    if (this.toggle = document.getElementById("toggleDrawing").innerHTML == "Disabled") {
        currentThis.nv.setDrawingEnabled(false);
    }

}

RealTimeDrawer.prototype.setSliceType = function (data, currentThis) {
    currentThis.nv.setSliceType(data);
    currentThis.viewer.view = data
}

RealTimeDrawer.prototype.SyncOnJoin = function (data, currentThis) {
    if (currentThis.isNewUser) {
        let newDataLength = data.currentDrawData?.length;
        currentThis.setSliceType(data.view, currentThis)
        if (newDataLength > currentThis.currentDrawData?.length) {
            data.currentDrawData.forEach(ele => {
                currentThis.drawOnPusherTrigger(ele, currentThis);
            });
        }

        if (data?.thisMM) {
            currentThis.nv.scene.crosshairPos = currentThis.nv.mm2frac(data?.thisMM);

        }
        currentThis.nv.drawScene();
        currentThis.nv.createOnLocationChange();


        currentThis.isNewUser = false;
    }
}


RealTimeDrawer.prototype.connect = function () {
    var channelname = 'cs410';

    console.log('Linking via channel ' + channelname + '...');

    // Pusher.logToConsole = true; // for debugging

    const pusher = new Pusher('bb9db0457c7108272899', {
        cluster: 'us2',
        userAuthentication: { endpoint: "https://x.babymri.org/auth.php" },
        authEndpoint: "https://x.babymri.org/auth.php"
    });

    var channel = 'private-' + channelname;
    LINK = pusher.subscribe(channel);
    let drawtoSubscibers = this.drawOnPusherTrigger;
    let setSliceType = this.setSliceType;
    let currentThis = this;
    let SyncOnJoin = this.SyncOnJoin;

    // Sync Annotations
    LINK.bind('client-receive', (data) => {
        if (data && data['drawing'].length > 0) {
            drawtoSubscibers(data, currentThis);
        }
    });

    // Sync Perspective View
    LINK.bind('client-set-slicetype', function (data) {
        setSliceType(data['view_number'], currentThis);
    });

    // Sync Slice View
    LINK.bind('client-receive-wheel', function (data) {
        console.log(data["data"]["mouse_args"])
        var m = data["data"]["mouse_args"]
        var u = data["data"]["canvas_info"]
        m.deltaY < 0 ? currentThis.nv.sliceScroll2D(-.01, m.clientX - u.left, m.clientY - u.top) : currentThis.nv.sliceScroll2D(.01, m.clientX - u.left, m.clientY - u.top)
    });

    // Sync Undo
    LINK.bind('client-undo', function (data) {
        currentThis.nv.drawUndo();
        currentThis.currentDrawData.pop()
    });

    // Sync Client on Join
    LINK.bind('client-sync-needed', (item) => {
        if (item.isNeeded) {
            LINK.trigger('client-sync-onjoin', {
                'currentDrawData': currentThis.currentDrawData,
                'view': currentThis.viewer.view,
                'thisMM': currentThis.nv.frac2mm(currentThis.nv.scene.crosshairPos),
            })
        }
    });

    LINK.bind('client-sync-onjoin', (item) => {
        try {
            jSuites.loading.show();
            SyncOnJoin(item, currentThis);
        } finally {
            jSuites.loading.hide();
        }

    });

    LINK.bind('pusher:subscription_succeeded', () => {
        try {
            currentThis.isNewUser = true;
            jSuites.loading.show();
            LINK.trigger('client-sync-needed', {
                'isNeeded': true
            });
        } catch (err) {
            jSuites.loading.hide();
        }

        setTimeout(function () {
            // Hide
            jSuites.loading.hide();
        }, 2000);

    });


};



