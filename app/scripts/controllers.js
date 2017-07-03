/**
 * INSPINIA - Responsive Admin Theme
 */

/**
 * MainCtrl - controller
 */
function MainCtrl() {

    this.userName = localStorage['pa.login'];
    this.selectedBucketIndex = 0;
}

angular
    .module('inspinia')
    .controller('MainCtrl', MainCtrl);
