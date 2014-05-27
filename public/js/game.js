
'use strict';

//global variables
window.onload = function () {
  var game = new Phaser.Game(800, 600, Phaser.AUTO, 'geek-defender');

  // Game States
  game.state.add('preload', Preload);
  game.state.add('play', Play);
  game.state.add('gameover', GameOver);

  game.state.start('preload');
};

function Preload() {
  this.asset = null;
  this.ready = false;
}

Preload.prototype = {
  preload: function() {
    this.game.stage.backgroundColor = '9ebcff';
    this.loadingText = this.game.add.text(this.game.world.centerX, this.game.world.centerY, 'Loading...', {
      fill: '#fff',
      align: 'center'
    });
    this.loadingText.anchor.setTo(0.5, 0.5);

    this.load.onLoadComplete.addOnce(this.onLoadComplete, this);
    this.load.image('yarn', 'assets/yarn.png');
    this.load.image('ground', 'assets/ground.png');
    this.load.image('castel', 'assets/castel.png');
    this.load.image('bar-bg', 'assets/bar-bg.png');
    this.load.image('bar-green', 'assets/bar-green.png');
    this.load.image('bar-red', 'assets/bar-red.png');
    this.load.image('heart', 'assets/heart.png');
    this.load.image('cloud', 'assets/cloud.png');
    this.load.image('geeks', 'assets/geeks.png');
    this.load.image('portal', 'assets/portal.png');
    this.load.image('crosshair', 'assets/crosshair.png');

    this.load.spritesheet('ninja', 'assets/ninja.png', 113, 50);

    this.load.audio('tension', ['assets/tension.mp3','assets/tension.ogg']);
    this.load.audio('release', ['assets/release.mp3','assets/release.ogg']);
  },
  create: function() {
    this.game.input.maxPointers = 1;
  },
  update: function() {
    if(!!this.ready) {
      this.game.state.start('play');
    }
  },
  onLoadComplete: function() {
    this.ready = true;
    this.loadingText.destroy();
  }
};

function Play() {}
Play.prototype = {
  create: function() {
    // Drawing the 'pretty' elements
    this.setUpStage();

    // Aquiring some land
    var ground = this.game.add.sprite(this.game.width/2 ,this.game.height - 14, 'ground');

    // Building ourselves a cast;e
    var castel = this.game.add.sprite(this.game.width - 84,this.game.height - 123, 'castel');

    // Setting up th physics
    this.game.physics.startSystem(Phaser.Physics.P2JS);
    this.game.physics.p2.setImpactEvents(true);
    this.game.physics.p2.gravity.y = 100;
    this.game.physics.p2.restitution = 0.5;
    this.yarnCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.groundCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.castelCollisionGroup = this.game.physics.p2.createCollisionGroup();
    this.ninjaCollisionGroup = this.game.physics.p2.createCollisionGroup();

    // Making the ground real
    this.game.physics.p2.enable(ground);
    ground.body.static=true;
    ground.body.setCollisionGroup(this.groundCollisionGroup);
    ground.body.collides([this.yarnCollisionGroup,this.ninjaCollisionGroup]);

    // Making the castel real
    this.game.physics.p2.enable(castel);
    castel.body.static = true;
    castel.body.setRectangle(80,140,0,40);
    castel.body.setCollisionGroup(this.castelCollisionGroup);
    castel.body.collides([this.ninjaCollisionGroup]);

    this.setUpBars();

    // Making noises
    this.tensionFX = this.game.add.audio('tension',1,true);
    this.releaseFX = this.game.add.audio('release');

    // Handling input
    this.game.input.onUp.add(this.launch, this);
    this.game.input.onDown.add(this.charge, this);

    // Initializing variables
    this.ignoreInput = false;
    this.reloadTimer = this.game.time.create(false);

    this.ninjas = this.game.add.group(undefined, "Ninjas", false, true, Phaser.Physics.P2JS);

    // Making ninjas fast and agile (also frictionless)
    this.ninjaMaterial = this.game.physics.p2.createMaterial('ninjaMaterial');
    var groundMaterial = this.game.physics.p2.createMaterial('groundMaterial', ground.body);
    var contactMaterial = this.game.physics.p2.createContactMaterial(groundMaterial, this.ninjaMaterial);
    contactMaterial.friction = 0.0;
    contactMaterial.restitution = 0.5;

    // Restoring lives
    this.lives = [];
    for (var i = 0; i < 5; i++) {
      this.lives.push(this.game.add.sprite(10 + i * 50, 10, 'heart'));
    }

    // Spawning a ninja
    this.game.time.events.add(2000, this.spawnNinja, this);

    this.crosshair = this.game.add.sprite(0, 0, 'crosshair');
    this.crosshair.anchor.set(0.5);

    this.missileSpawnPoint = new Phaser.Point();
    this.missileSpawnPoint.x = this.game.width - 125 + 20;
    this.missileSpawnPoint.y = this.game.height - 260 + 20;
  },

  setUpStage: function() {
    this.game.stage.backgroundColor = '9ebcff';
    this.game.add.sprite(80, 50, 'cloud');
    this.game.add.sprite(this.game.width - 300, 80, 'cloud');
    this.game.add.sprite(10, this.game.height/2, 'portal');
    this.game.add.sprite(this.game.width - 150, this.game.height-285, 'geeks');
  },

  setUpBars: function() {
    this.game.add.sprite(this.game.width - 200,20, 'bar-bg');
    this.powerBar = this.game.add.sprite(this.game.width - 198,22, 'bar-green');
    this.powerBar.crop(new Phaser.Rectangle(0,0,0,20));
    this.reloadBar = this.game.add.sprite(this.game.width - 198,22, 'bar-red');
    this.reloadBar.crop(new Phaser.Rectangle(0,0,0,20));
  },

  update: function() {
    if(!this.ignoreInput) {
      if(this.game.input.activePointer.isDown) {
        this.powerBar.crop(new Phaser.Rectangle(0,0,120/300*Math.min(300,this.game.input.activePointer.duration/4),20));
      }
    }
    if(this.reloading) {
      this.reloadBar.crop(new Phaser.Rectangle(0,0,120/1000*this.reloadTimer.duration,20));
    } else {
      if (!this.game.input.activePointer.position.isZero()) {
        this.crosshair.x = this.game.input.activePointer.position.x;
        this.crosshair.y = this.game.input.activePointer.position.y;
      }
    }
  },

  spawnNinja: function() {
    var ninja = this.ninjas.create(50, this.game.world.height/2 + 80, 'ninja');
    ninja.animations.add('run');
    ninja.animations.play('run', 15, true)
    ninja.body.setRectangle(54, 40, -10, 0);
    ninja.body.velocity.x = 50 + Math.random() * 30;
    ninja.body.setCollisionGroup(this.ninjaCollisionGroup);
    ninja.body.collides([this.groundCollisionGroup,this.yarnCollisionGroup]);
    ninja.body.collides([this.castelCollisionGroup],this.ninjaReachedCastle, this);
    ninja.body.damping = 0;
    ninja.body.setMaterial(this.ninjaMaterial);
    this.game.time.events.add(Math.random() * 2000 + 2000, this.spawnNinja, this);
  },

  charge: function() {
    if(!this.reloading){
      this.ignoreInput = false;
      this.tensionFX.play();
    }
  },

  killYarn: function() {
    var yarn = this;
    if(yarn.alive) {
      yarn.game.add.tween(yarn).to( { alpha: 0.0 },
        1000,
        Phaser.Easing.Linear.None,
        true
      ).onComplete.add(function(){yarn.destroy();});
    }
  },

  finishReloading: function() {
    this.reloading = false;
    this.reloadBar.crop(new Phaser.Rectangle(0,0,0,20));
    this.reloadingText.destroy();
  },

  launch: function() {
    if(!this.ignoreInput) {
      this.powerBar.crop(new Phaser.Rectangle(0,0,0,20));
      this.ignoreInput = true;

      this.tensionFX.stop();
      this.releaseFX.play();

      var yarn = this.game.add.sprite(this.missileSpawnPoint.x, this.missileSpawnPoint.y, 'yarn');
      this.game.physics.p2.enable(yarn);
      yarn.body.rotateLeft(Math.random() * 300);
      yarn.body.setCircle(20, -14, 1);
      yarn.anchor.set(0.3, 0.5);
      yarn.body.collideWorldBounds = false;
      yarn.body.setCollisionGroup(this.yarnCollisionGroup);
      yarn.body.collides([this.groundCollisionGroup]);
      yarn.body.collides([this.ninjaCollisionGroup], this.ninjaYarnHit, this);
      var speedVectorLength = Math.sqrt(
        Math.pow(this.missileSpawnPoint.x - this.game.input.x,2) +
        Math.pow(this.missileSpawnPoint.y - this.game.input.y,2)
      );
      var nomralizedXspeed = (this.missileSpawnPoint.x - this.game.input.x)/speedVectorLength;
      var nomralizedYspeed = (this.missileSpawnPoint.y - this.game.input.y)/speedVectorLength;
      yarn.body.velocity.x = -1 *
        Math.min(500,this.game.input.activePointer.duration/3) *
        nomralizedXspeed;
      yarn.body.velocity.y = -1 *
        Math.min(500,this.game.input.activePointer.duration/3) *
        nomralizedYspeed;
      this.game.time.events.add(Phaser.Timer.SECOND * 10, this.killYarn, yarn);

      // Reloading
      this.reloadTimer.add(1000, this.finishReloading, this);
      this.reloadTimer.start();
      this.reloading = true;
      this.game.time.events.add(2000, this.finishReloading, this);
      this.reloadingText = this.game.add.text(this.game.width - 200,
        50,
        "RELOADING",
        { font: "15px Arial", fill: "#ff0044", align: "center" }
      );
      this.game.add.tween(this.reloadingText).to( { alpha: 0 }, 400, Phaser.Easing.Linear.None, true, 0, 1000, true);
    }
  },

  ninjaYarnHit: function(yarn, ninja) {
    //ninja.sprite.destroy();
    if(ninja.sprite && yarn.sprite) {
      ninja.sprite.body.clearCollision(true,true);
      ninja.sprite.body.velocity.x = 0;
      ninja.sprite.body.velocity.y = -100;
      this.game.time.events.add(Phaser.Timer.SECOND * 10, function() { this.sprite.destroy() }, ninja);
      yarn.sprite.body.clearCollision(true,true);
      yarn.sprite.body.velocity.x = 0;
      yarn.sprite.body.velocity.y = -100;
    }
  },

  ninjaReachedCastle: function(ninja, castel) {
    ninja.sprite.destroy();

    var life = this.lives.pop();
    life.destroy();

    if (this.lives.length == 0) {
      this.game.state.start('gameover');
    }
  },

  render: function() {
  }
};

function GameOver() {}

GameOver.prototype = {
  preload: function () {

  },
  create: function () {
    var style = { font: '65px Arial', fill: '#ffffff', align: 'center'};
    this.titleText = this.game.add.text(this.game.world.centerX,100, 'Game Over!', style);
    this.titleText.anchor.setTo(0.5, 0.5);

    this.congratsText = this.game.add.text(this.game.world.centerX, 200, 'You Lose!', { font: '32px Arial', fill: '#ffffff', align: 'center'});
    this.congratsText.anchor.setTo(0.5, 0.5);

    this.instructionText = this.game.add.text(this.game.world.centerX, 300, 'Click To Play Again', { font: '16px Arial', fill: '#ffffff', align: 'center'});
    this.instructionText.anchor.setTo(0.5, 0.5);
  },
  update: function () {
    if(this.game.input.activePointer.justPressed()) {
      this.game.state.start('play');
    }
  }
};
