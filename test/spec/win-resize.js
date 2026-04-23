/* eslint-env jasmine */
/* global loadPage:false */
/* eslint no-underscore-dangle: [2, {"allow": ["_id"]}] */

describe('window resize', function() {
  'use strict';

  var window, document, traceLog, pageDone, frame, pathDataHasChanged,
    iframeDoc, iframe, ll1, ll2, ll3, ll4;

  function dispatchResize(targetWindow) {
    var event;
    if (typeof targetWindow.Event === 'function') {
      event = new targetWindow.Event('resize');
      targetWindow.dispatchEvent(event);
    } else {
      event = targetWindow.document.createEvent('UIEvents');
      event.initUIEvent('resize', true, false, targetWindow, 0);
      targetWindow.dispatchEvent(event);
    }
  }

  function afterResize(targetWindow, callback, readyCheck, retryCount) {
    retryCount = retryCount || 0;
    setTimeout(function() {
      var log = traceLog.getTaggedLog('positionByWindowResize');
      if (log && log.length && (!readyCheck || readyCheck())) {
        callback();
      } else if (retryCount < 5) {
        dispatchResize(targetWindow);
        afterResize(targetWindow, callback, readyCheck, retryCount + 1);
      } else {
        callback();
      }
    }, 100);
  }

  function loadBefore(beforeDone) {
    loadPage('spec/win-resize/page.html', function(frmWindow, frmDocument, body, done) {
      window = frmWindow;
      document = frmDocument;
      frame = window.frameElement;

      iframe = document.getElementById('iframe1');
      iframeDoc = iframe.contentDocument;
      ll1 = new window.LeaderLine(document.getElementById('elm1'), document.getElementById('elm2'));
      ll2 = new window.LeaderLine(document.getElementById('elm3'), document.getElementById('elm4'));
      ll3 = new window.LeaderLine(iframeDoc.getElementById('elm1'), iframeDoc.getElementById('elm2'));
      ll4 = new window.LeaderLine(iframeDoc.getElementById('elm3'), iframeDoc.getElementById('elm4'));

      traceLog = window.traceLog;
      traceLog.enabled = true;
      pathDataHasChanged = window.pathDataHasChanged;
      window.LeaderLine.positionByWindowResize = true;
      pageDone = done;
      // Let initial iframe/window resize noise settle, then sync all lines to the settled layout.
      setTimeout(function() {
        [ll1, ll2, ll3, ll4].forEach(function(ll) { ll.position(); });
        traceLog.clear();
        beforeDone();
      }, 1000 / 60);
    }, 'window resize');
  }

  beforeEach(loadBefore);

  afterEach(function() {
    window.LeaderLine.positionByWindowResize = true;
    pageDone();
  });

  it('update position when window is resized', function(done) {
    var pathData1, pathData2, pathData3, pathData4, frameBBox;

    pathData1 = window.insProps[ll1._id].linePath.getPathData();
    pathData2 = window.insProps[ll2._id].linePath.getPathData();
    pathData3 = window.insProps[ll3._id].linePath.getPathData();
    pathData4 = window.insProps[ll4._id].linePath.getPathData();

    frameBBox = frame.getBoundingClientRect();
    traceLog.clear();
    frame.style.width = (frameBBox.width - 50) + 'px';
    afterResize(window, function() {
      var resizeLog = traceLog.getTaggedLog('positionByWindowResize') || [];
      expect(resizeLog.slice(-4)).toEqual(['id=1', 'id=2', 'id=3', 'id=4']);
      expect(pathDataHasChanged(pathData1, window.insProps[ll1._id].linePath.getPathData())).toBe(true);
      expect(pathDataHasChanged(pathData2, window.insProps[ll2._id].linePath.getPathData())).toBe(true);
      expect(pathDataHasChanged(pathData3, window.insProps[ll3._id].linePath.getPathData())).toBe(true);
      expect(pathDataHasChanged(pathData4, window.insProps[ll4._id].linePath.getPathData())).toBe(true);
      done();
    }, function() {
      return pathDataHasChanged(pathData1, window.insProps[ll1._id].linePath.getPathData()) &&
        pathDataHasChanged(pathData2, window.insProps[ll2._id].linePath.getPathData()) &&
        pathDataHasChanged(pathData3, window.insProps[ll3._id].linePath.getPathData()) &&
        pathDataHasChanged(pathData4, window.insProps[ll4._id].linePath.getPathData());
    });
  });

  it('update only position in sub window when sub window is resized', function(done) {
    var pathData1, pathData2, pathData3, pathData4;

    pathData1 = window.insProps[ll1._id].linePath.getPathData();
    pathData2 = window.insProps[ll2._id].linePath.getPathData();
    pathData3 = window.insProps[ll3._id].linePath.getPathData();
    pathData4 = window.insProps[ll4._id].linePath.getPathData();

    traceLog.clear();
    iframe.style.width = '50%';
    afterResize(iframe.contentWindow, function() {
      expect(traceLog.getTaggedLog('positionByWindowResize').slice(-2)).toEqual(['id=3', 'id=4']);
      expect(pathDataHasChanged(pathData1, window.insProps[ll1._id].linePath.getPathData())).toBe(false);
      expect(pathDataHasChanged(pathData2, window.insProps[ll2._id].linePath.getPathData())).toBe(false);
      expect(pathDataHasChanged(pathData3, window.insProps[ll3._id].linePath.getPathData())).toBe(true);
      expect(pathDataHasChanged(pathData4, window.insProps[ll4._id].linePath.getPathData())).toBe(true);
      done();
    }, function() {
      return pathDataHasChanged(pathData3, window.insProps[ll3._id].linePath.getPathData()) &&
        pathDataHasChanged(pathData4, window.insProps[ll4._id].linePath.getPathData());
    });
  });

  it('update only lines in resized window even if it is not changed', function(done) {
    var pathData1, pathData2, pathData3, pathData4;

    pathData1 = window.insProps[ll1._id].linePath.getPathData();
    pathData2 = window.insProps[ll2._id].linePath.getPathData();
    pathData3 = window.insProps[ll3._id].linePath.getPathData();
    pathData4 = window.insProps[ll4._id].linePath.getPathData();

    traceLog.clear();
    dispatchResize(window);
    afterResize(window, function() {
      expect(traceLog.getTaggedLog('positionByWindowResize').slice(-2)).toEqual(['id=1', 'id=2']);
      expect(traceLog.getTaggedLog('updatePosition').slice(-2)).toEqual([
        'not-updated', 'not-updated' // ll1, ll2
      ]);
      expect(pathDataHasChanged(pathData1, window.insProps[ll1._id].linePath.getPathData())).toBe(false);
      expect(pathDataHasChanged(pathData2, window.insProps[ll2._id].linePath.getPathData())).toBe(false);
      expect(pathDataHasChanged(pathData3, window.insProps[ll3._id].linePath.getPathData())).toBe(false); // No change
      expect(pathDataHasChanged(pathData4, window.insProps[ll4._id].linePath.getPathData())).toBe(false); // No change
      done();
    });
  });

  it('disabled positionByWindowResize', function(done) {
    var pathData1, pathData2, pathData3, pathData4, frameBBox,
      elm1 = document.getElementById('elm1'), elm2 = document.getElementById('elm2'), elm1Left, elm2Left;

    pathData1 = window.insProps[ll1._id].linePath.getPathData();
    pathData2 = window.insProps[ll2._id].linePath.getPathData();
    pathData3 = window.insProps[ll3._id].linePath.getPathData();
    pathData4 = window.insProps[ll4._id].linePath.getPathData();
    elm1Left = elm1.getBoundingClientRect().left;
    elm2Left = elm2.getBoundingClientRect().left;

    frameBBox = frame.getBoundingClientRect();
    window.LeaderLine.positionByWindowResize = false;
    traceLog.clear();
    frame.style.width = (frameBBox.width + 70) + 'px';
    dispatchResize(window);
    setTimeout(function() {
      expect(elm1.getBoundingClientRect().left).not.toBe(elm1Left);
      expect(elm2.getBoundingClientRect().left).not.toBe(elm2Left);
      expect(traceLog.getTaggedLog('positionByWindowResize')).toEqual([]);
      expect(pathDataHasChanged(pathData1, window.insProps[ll1._id].linePath.getPathData())).toBe(false);
      expect(pathDataHasChanged(pathData2, window.insProps[ll2._id].linePath.getPathData())).toBe(false);
      expect(pathDataHasChanged(pathData3, window.insProps[ll3._id].linePath.getPathData())).toBe(false);
      expect(pathDataHasChanged(pathData4, window.insProps[ll4._id].linePath.getPathData())).toBe(false);
      done();
    }, 100);
  });
});

describe('window resize guards', function() {
  'use strict';

  var window, document, traceLog, pageDone, pathDataHasChanged, ll;

  function dispatchResize(targetWindow) {
    var event;
    if (typeof targetWindow.Event === 'function') {
      event = new targetWindow.Event('resize');
      targetWindow.dispatchEvent(event);
    } else {
      event = targetWindow.document.createEvent('UIEvents');
      event.initUIEvent('resize', true, false, targetWindow, 0);
      targetWindow.dispatchEvent(event);
    }
  }

  function loadBefore(beforeDone) {
    loadPage('spec/common/page.html', function(frmWindow, frmDocument, body, done) {
      window = frmWindow;
      document = frmDocument;
      traceLog = window.traceLog;
      traceLog.enabled = true;
      pathDataHasChanged = window.pathDataHasChanged;
      pageDone = done;
      ll = new window.LeaderLine(document.getElementById('elm1'), document.getElementById('elm2'));
      beforeDone();
    });
  }

  beforeEach(loadBefore);

  afterEach(function() {
    window.LeaderLine.positionByWindowResize = true;
    pageDone();
  });

  it('does not re-read geometry for hidden anchors on resize', function(done) {
    var props = window.insProps[ll._id], pathData = props.linePath.getPathData();

    document.getElementById('elm1').style.display = 'none';

    traceLog.clear();
    dispatchResize(window);
    setTimeout(function() {
      expect(traceLog.getTaggedLog('positionByWindowResize')).toEqual([]);
      expect(traceLog.getTaggedLog('updatePosition') == null).toBe(true);
      expect(pathDataHasChanged(pathData, props.linePath.getPathData())).toBe(false);
      done();
    }, 100);
  });

  it('does not error for disconnected anchors on resize', function(done) {
    var props = window.insProps[ll._id], pathData = props.linePath.getPathData(),
      elm1 = document.getElementById('elm1');

    spyOn(window.console, 'error');
    elm1.parentNode.removeChild(elm1);

    traceLog.clear();
    dispatchResize(window);
    setTimeout(function() {
      expect(window.console.error).not.toHaveBeenCalled();
      expect(traceLog.getTaggedLog('positionByWindowResize')).toEqual([]);
      expect(traceLog.getTaggedLog('updatePosition') == null).toBe(true);
      expect(pathDataHasChanged(pathData, props.linePath.getPathData())).toBe(false);
      done();
    }, 100);
  });
});
