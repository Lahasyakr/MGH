

class RealTimeDrawer {
    constructor(viewer) {
        this.nv = viewer.nv;
        this.viewer = viewer
        this.setUpInteraction();
        this.currentDrawData = []


    }
}
RealTimeDrawer.prototype.setUpInteraction = function () {

    const element = document.getElementById('viewer');

    element.onmousemove = this.onMouseMove.bind(this);
    element.onmouseup = this.onMouseUp.bind(this);
    element.onkeydown = this.onKeyDown.bind(this);
    this.connect();
    this.SetupColor()
}
function ViewColorMap(num) {
  return [{ "id": 1, "label": "red" }, { "id": 2, "label": "green" }, { "id": 3, "label": "blue" },
  { "id": 4, "label": "yellow" }, { "id": 5, "label": "cycan" }].find(x => x.id == num).label
}
RealTimeDrawer.prototype.SetupColor = function () {
  this.pencolorWrapper = document.getElementById("color");
  this.penlabel = this.pencolorWrapper.children.namedItem("label")
  this.penlabel.innerHTML = "Pen Color: " + ViewColorMap(1)
  this.nv.setPenValue(1, true);
  this.nv.setDrawingEnabled(true);
  this.penslider = this.pencolorWrapper.children.namedItem("slider")
  this.penslider.onchange = (e) => {
    this.penlabel.innerHTML = "Pen Color: " + ViewColorMap(e.target.value)
    this.nv.setDrawingEnabled(true);
    this.nv.setPenValue(e.target.value, true);
  }
}
RealTimeDrawer.prototype.onMouseMove = function (e) {
    this.draw()
};

RealTimeDrawer.prototype.onMouseUp = function (e) {
    this.nv.refreshDrawing();
    let shareObj = { 'undo': false, 'drawing': last_drawing, 'label': this.nv.opts.penValue, 'view_number': this.viewer.view };
    this.currentDrawData.push(shareObj);
    // send via pusher
    LINK.trigger('client-receive', shareObj);


};

RealTimeDrawer.prototype.onKeyDown = function (e) {

    if (e.keyCode == 49) {
        // Red - click 1
        this.nv.setDrawingEnabled(!this.nv.opts.drawingEnabled);
        this.nv.setPenValue(1, true);
    }
    else if (e.keyCode == 50) {
        // Green - click 2
        this.nv.setDrawingEnabled(!this.nv.opts.drawingEnabled);
        this.nv.setPenValue(2, true);
    }
    else if (e.code == 'Space') {
        // space - change view
        this.viewer.changeView()
        LINK.trigger('client-set-slicetype', { 'view_number': this.viewer.view });
    }
    else if (e.keyCode == 90 && e.ctrlKey) {
        // capturing ctrl + zfor undo
        console.log(this.nv.drawBitmap)
        this.nv.drawUndo();
        this.currentDrawData.pop()
        LINK.trigger('client-undo', {});

    }
    else if (e.keyCode == 89 && e.ctrlKey) {
        //save drawing as image on Ctrl + Y
        this.saveDrawing()
    }

    this.nv.updateGLVolume()
}


RealTimeDrawer.prototype.saveDrawing = function () {
    this.nv.saveScene("niivue.png")

};

RealTimeDrawer.prototype.draw = function () {
    //console.log(nv.drawPenFillPts)
    if (this.nv.drawPenFillPts.length > 0) {
        last_drawing = this.nv.drawPenFillPts;
    }

};

RealTimeDrawer.prototype.drawFilled = function (ptA, ptB, label, nv) {
    if (!nv.opts.drawingEnabled) {
        nv.setDrawingEnabled(true);
    }
    //nv.setDrawingEnabled(false);
    nv.drawPenLine(ptA, ptB, label)
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
        currentThis.drawFilled(startPt, endpoint, value, currentThis.nv)
        startPt = endpoint;
        currentThis.nv.refreshDrawing(true);
    }
    //coonecting the first and last point
    currentThis.drawFilled(constStartpt, endpoint, value, currentThis.nv);
    currentThis.nv.drawAddUndoBitmap();
    currentThis.currentDrawData.push(data)
    currentThis.nv.setSliceType(data['view_number']);
    currentThis.nv.setDrawingEnabled(false);
}

RealTimeDrawer.prototype.setSliceType = function (data, currentThis) {
    currentThis.nv.setSliceType(data);
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
    LINK.bind('client-receive', (data) => {
        drawtoSubscibers(data, currentThis);
    });
    LINK.bind('client-set-slicetype', function (data) {
        setSliceType(data['view_number'], currentThis);
    });
    LINK.bind('client-undo', function (data) {
        currentThis.nv.drawUndo();
        currentThis.currentDrawData.pop()
    });



};


